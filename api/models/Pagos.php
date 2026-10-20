<?php
declare(strict_types=1);

function getPaymentBehavior(PDO $db): array
{
    $rows = $db->query(
        "SELECT c.id AS cliente_id, c.cedula_rif, c.nombre_razon_social,
                f.id AS factura_id, f.numero_factura, f.monto_total, f.saldo_pendiente,
                f.fecha_vencimiento, f.estatus_pago, CURRENT_DATE AS fecha_actual,
                pagos.ultimo_abono, recordatorios.cantidad AS cantidad_recordatorios,
                recordatorios.ultimo_recordatorio
         FROM clientes c
         LEFT JOIN facturas_venta f ON f.cliente_id = c.id
         LEFT JOIN (
           SELECT factura_id, MAX(fecha_abono) AS ultimo_abono
           FROM abonos_facturas GROUP BY factura_id
         ) pagos ON pagos.factura_id = f.id
         LEFT JOIN (
           SELECT factura_id, COUNT(*) AS cantidad, MAX(fecha_recordatorio) AS ultimo_recordatorio
           FROM recordatorios_pago GROUP BY factura_id
         ) recordatorios ON recordatorios.factura_id = f.id
         WHERE c.estado = 'ACTIVO'
         ORDER BY c.nombre_razon_social, f.fecha_vencimiento, f.id",
    )->fetchAll();

    $clients = [];
    $summary = [
        'pagadas_a_tiempo' => 0,
        'pagadas_antes_vencimiento' => 0,
        'pagadas_despues_recordatorio' => 0,
        'pagadas_tarde_sin_recordatorio' => 0,
        'pagadas_sin_fecha' => 0,
        'pendientes_vencidas' => 0,
        'pendientes_total' => 0,
        'recordatorios_pendientes' => 0,
    ];

    foreach ($rows as $row) {
        $clientId = (int) $row['cliente_id'];
        if (!isset($clients[$clientId])) {
            $clients[$clientId] = [
                'cliente_id' => $clientId,
                'cedula_rif' => $row['cedula_rif'],
                'nombre_razon_social' => $row['nombre_razon_social'],
                'pagadas_a_tiempo' => 0,
                'pagadas_antes_vencimiento' => 0,
                'pagadas_despues_recordatorio' => 0,
                'pagadas_tarde_sin_recordatorio' => 0,
                'pagadas_sin_fecha' => 0,
                'facturas_pagadas_con_fecha' => 0,
                'pendientes_vencidas' => 0,
                'pendientes_total' => 0,
                'recordatorios_pendientes' => 0,
                'facturas_pendientes' => [],
            ];
        }
        if ($row['factura_id'] === null) {
            continue;
        }

        $paid = (float) $row['saldo_pendiente'] <= 0 || $row['estatus_pago'] === 'PAGADO';
        if ($paid) {
            if ($row['ultimo_abono'] === null) {
                $clients[$clientId]['pagadas_sin_fecha']++;
                $summary['pagadas_sin_fecha']++;
                continue;
            }
            $clients[$clientId]['facturas_pagadas_con_fecha']++;
            $paidDate = substr($row['ultimo_abono'], 0, 10);
            $paidOnTime = $paidDate <= $row['fecha_vencimiento'];
            if ($paidOnTime) {
                $clients[$clientId]['pagadas_antes_vencimiento']++;
                $summary['pagadas_antes_vencimiento']++;
            }
            $paidAfterReminder = $row['ultimo_recordatorio'] !== null
                && $row['ultimo_recordatorio'] <= $row['ultimo_abono'];
            if ($paidAfterReminder) {
                $clients[$clientId]['pagadas_despues_recordatorio']++;
                $summary['pagadas_despues_recordatorio']++;
            } elseif ($paidOnTime) {
                $clients[$clientId]['pagadas_a_tiempo']++;
                $summary['pagadas_a_tiempo']++;
            } else {
                $clients[$clientId]['pagadas_tarde_sin_recordatorio']++;
                $summary['pagadas_tarde_sin_recordatorio']++;
            }
            continue;
        }

        $overdue = $row['fecha_vencimiento'] < $row['fecha_actual'];
        $reminderCount = (int) ($row['cantidad_recordatorios'] ?? 0);
        $clients[$clientId]['pendientes_total']++;
        $clients[$clientId]['pendientes_vencidas'] += $overdue ? 1 : 0;
        $clients[$clientId]['recordatorios_pendientes'] += $reminderCount;
        $summary['pendientes_total']++;
        $summary['pendientes_vencidas'] += $overdue ? 1 : 0;
        $summary['recordatorios_pendientes'] += $reminderCount;
        $clients[$clientId]['facturas_pendientes'][] = [
            'factura_id' => (int) $row['factura_id'],
            'numero_factura' => $row['numero_factura'],
            'saldo_pendiente' => $row['saldo_pendiente'],
            'fecha_vencimiento' => $row['fecha_vencimiento'],
            'vencida' => $overdue,
            'cantidad_recordatorios' => $reminderCount,
            'ultimo_recordatorio' => $row['ultimo_recordatorio'],
        ];
    }

    foreach ($clients as &$client) {
        $knownPayments = $client['facturas_pagadas_con_fecha'];
        $client['probabilidad_a_tiempo'] = $knownPayments > 0
            ? round($client['pagadas_antes_vencimiento'] / $knownPayments * 100, 1)
            : null;
        $client['clasificacion'] = $client['pendientes_vencidas'] > 0
            ? 'Requiere seguimiento'
            : ($knownPayments < 2
                ? 'Historial insuficiente'
                : ($client['probabilidad_a_tiempo'] >= 80
                    ? 'Probable pago a tiempo'
                    : ($client['probabilidad_a_tiempo'] < 50
                        ? 'Requiere seguimiento'
                        : 'Seguimiento preventivo')));
    }
    unset($client);

    $knownPayments = $summary['pagadas_a_tiempo']
        + $summary['pagadas_despues_recordatorio']
        + $summary['pagadas_tarde_sin_recordatorio'];
    return [
        'summary' => $summary + [
            'clientes_analizados' => count($clients),
            'facturas_pagadas_con_fecha' => $knownPayments,
            'probabilidad_global_a_tiempo' => $knownPayments > 0
                ? round($summary['pagadas_antes_vencimiento'] / $knownPayments * 100, 1)
                : null,
        ],
        'clients' => array_values($clients),
    ];
}

function recordPaymentReminder(PDO $db, int $invoiceId): array
{
    $db->beginTransaction();
    try {
        $invoiceQuery = $db->prepare(
            "SELECT id, numero_factura FROM facturas_venta
             WHERE id = :id AND saldo_pendiente > 0
             AND estatus_pago IN ('PENDIENTE', 'VENCIDO') FOR UPDATE",
        );
        $invoiceQuery->execute(['id' => $invoiceId]);
        $invoice = $invoiceQuery->fetch();
        if ($invoice === false) {
            throw new ApiException(404, 'No se encontró una factura pendiente para registrar el recordatorio.');
        }

        $statement = $db->prepare(
            'INSERT INTO recordatorios_pago (factura_id) VALUES (:factura_id)',
        );
        $statement->execute(['factura_id' => $invoiceId]);
        $reminder = [
            'id' => (int) $db->lastInsertId(),
            'factura_id' => $invoiceId,
            'numero_factura' => $invoice['numero_factura'],
        ];
        $db->commit();
        return $reminder;
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function recordReceivablePayment(PDO $db, int $invoiceId, array $payload): array
{
    $amount = $payload['monto'] ?? null;
    if (!is_numeric($amount) || !is_finite((float) $amount)
        || (float) $amount <= 0 || (float) $amount > 999999999999.99
        || abs((float) $amount * 100 - round((float) $amount * 100)) > 0.00001) {
        throw new ApiException(422, 'El abono debe ser un monto positivo con hasta dos decimales.');
    }
    $amountCents = (int) round((float) $amount * 100);
    $formattedAmount = sprintf('%d.%02d', intdiv($amountCents, 100), $amountCents % 100);

    $db->beginTransaction();
    try {
        $invoiceQuery = $db->prepare(
            'SELECT id, saldo_pendiente, estatus_pago FROM facturas_venta WHERE id = :id FOR UPDATE',
        );
        $invoiceQuery->execute(['id' => $invoiceId]);
        $invoice = $invoiceQuery->fetch();
        if ($invoice === false) {
            throw new ApiException(404, 'No se encontró la factura solicitada.');
        }
        $balanceCents = (int) round((float) $invoice['saldo_pendiente'] * 100);
        if ($amountCents > $balanceCents || $balanceCents <= 0) {
            throw new ApiException(422, 'El abono debe ser positivo y no puede superar el saldo pendiente.');
        }
        $remainingCents = $balanceCents - $amountCents;
        $remaining = sprintf('%d.%02d', intdiv($remainingCents, 100), $remainingCents % 100);
        $payment = $db->prepare(
            'INSERT INTO abonos_facturas (factura_id, monto) VALUES (:factura_id, :monto)',
        );
        $payment->execute(['factura_id' => $invoiceId, 'monto' => $formattedAmount]);
        $update = $db->prepare(
            "UPDATE facturas_venta SET saldo_pendiente = :saldo,
             estatus_pago = CASE WHEN :saldo_cero = 0 THEN 'PAGADO' ELSE estatus_pago END
             WHERE id = :id",
        );
        $update->execute(['saldo' => $remaining, 'saldo_cero' => $remainingCents, 'id' => $invoiceId]);
        $db->commit();
        return [
            'id' => (int) $db->lastInsertId(),
            'factura_id' => $invoiceId,
            'monto' => $formattedAmount,
            'saldo_pendiente' => $remaining,
            'estatus_pago' => $remainingCents === 0 ? 'PAGADO' : $invoice['estatus_pago'],
        ];
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}
