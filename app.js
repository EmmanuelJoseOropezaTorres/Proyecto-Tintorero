(() => {
  'use strict';

  const API_BASE = window.VALERY_API_BASE
    || new URLSearchParams(window.location.search).get('api')
    || new URL('./api', window.location.href).toString().replace(/\/$/, '');
  const pageContent = document.querySelector('#page-content');
  const breadcrumbTitle = document.querySelector('#breadcrumb-title');
  const clientDialog = document.querySelector('#client-dialog');
  const clientForm = document.querySelector('#client-form');
  const paymentDialog = document.querySelector('#payment-dialog');
  const paymentForm = document.querySelector('#payment-form');
  const toastElement = document.querySelector('#toast');

  const state = {
    view: 'clientes',
    page: 1,
    pageSize: 10,
    search: '',
    clientStatus: 'ACTIVO',
    products: null,
    productCategory: '',
    receivables: null,
    alerts: null,
    alertDays: 7,
    editingClientId: null,
    saving: false,
    deletingId: null,
    savingPrices: false,
    priceForm: { modo: 'tasa_cambio', valor: '', categoria_id: '' },
    loading: false,
    error: '',
    statistics: {
      x: '1 2 3 4 5 6 7 8',
      y: '52 55 61 65 68 72 75 81',
    },
    paymentBehavior: null,
    statisticsLoading: false,
    statisticsError: '',
    recordingReminder: null,
    payingInvoice: null,
  };

  let searchTimer;
  let toastTimer;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function formatMoney(value, currency = 'VES') {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.valueOf())
      ? '—'
      : new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(date);
  }

  function queryString(parameters) {
    const query = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) query.set(key, value);
    });
    return query.size ? `?${query.toString()}` : '';
  }

  async function apiRequest(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'same-origin',
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new Error(`No se pudo conectar con la API (${API_BASE}). Revisa Apache, MySQL y la configuración de conexión.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(
        response.status >= 500
          ? 'El servidor o la base de datos no están disponibles.'
          : `El servidor devolvió una respuesta no válida (código ${response.status}).`,
      );
    }
    if (!response.ok) {
      const error = new Error(payload.error?.message || `Error de comunicación (código ${response.status}).`);
      error.status = response.status;
      error.details = payload.error?.details || [];
      throw error;
    }
    return payload;
  }

  async function verifySession() {
    try {
      const response = await apiRequest('/autenticacion/sesion');
      document.querySelector('#account-name').textContent = response.data.nombre;
      loadClients();
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('./login.html');
        return;
      }
      state.error = error.message;
      renderClients();
    }
  }

  function showToast(message) {
    toastElement.textContent = message;
    toastElement.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastElement.hidden = true; }, 3500);
  }

  function showError(message) {
    return `<div class="alert" role="alert"><span class="alert-symbol">!</span><span>${escapeHtml(message)}</span><button class="alert-close" type="button" data-retry>Reintentar</button></div>`;
  }

  function loadingRow(columns, label) {
    return `<tr><td colspan="${columns}"><div class="loading-state"><span class="spinner"></span>${escapeHtml(label)}</div></td></tr>`;
  }

  function emptyRow(columns, title, detail) {
    return `<tr><td colspan="${columns}"><div class="empty-state"><span>⌕</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></td></tr>`;
  }

  function metric(label, value, icon, color, note) {
    return `<article class="metric-card"><div class="metric-top"><span>${escapeHtml(label)}</span><span class="metric-icon ${color}">${icon}</span></div><strong class="${String(value).length > 13 ? 'metric-balance' : ''}">${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
  }

  function pageHeading(eyebrow, title, subtitle, action = '') {
    return `<section class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</section>`;
  }

  function render() {
    document.querySelectorAll('[data-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === state.view);
    });
    const viewTitles = {
      clientes: 'Clientes',
      precios: 'Ajustes de precios',
      deudas: 'Cuentas por cobrar',
      estadistica: 'Estadística',
    };
    breadcrumbTitle.textContent = viewTitles[state.view] || 'Clientes';

    if (state.view === 'clientes') renderClients();
    if (state.view === 'precios') renderProducts();
    if (state.view === 'deudas') renderReceivables();
    if (state.view === 'estadistica') renderStatistics();
  }

  function renderStatistics() {
    const data = state.paymentBehavior;
    const summary = data?.summary;
    const clients = data?.clients || [];
    const openInvoices = clients.flatMap((client) => client.facturas_pendientes.map((invoice) => ({ ...invoice, nombre_razon_social: client.nombre_razon_social, cedula_rif: client.cedula_rif })));
    const classifications = [
      ['Pagó a tiempo, sin llamada', summary?.pagadas_a_tiempo || 0, 'on-time'],
      ['Pagó después de llamada', summary?.pagadas_despues_recordatorio || 0, 'reminded'],
      ['Pagó tarde, sin llamada', summary?.pagadas_tarde_sin_recordatorio || 0, 'late'],
    ];
    const classifiedPayments = classifications.reduce((total, [, count]) => total + count, 0);
    const historyChart = classifiedPayments
      ? `<div class="behavior-chart" role="img" aria-label="Distribución de ${classifiedPayments} facturas pagadas"><div class="behavior-chart-bar">${classifications.map(([label, count, color]) => `<span class="behavior-chart-segment ${color}" style="width:${count / classifiedPayments * 100}%" title="${escapeHtml(label)}: ${count}"></span>`).join('')}</div><div class="behavior-legend">${classifications.map(([label, count, color]) => `<span><i class="${color}"></i>${escapeHtml(label)} <strong>${count}</strong></span>`).join('')}</div></div>`
      : '<p class="statistics-note">Aún no hay pagos finalizados con fecha registrada para graficar. El análisis se actualizará al registrar pagos y recordatorios.</p>';
    const clientRows = clients.length
      ? clients.map((client) => {
        const probability = client.probabilidad_a_tiempo;
        const historyCount = Number(client.facturas_pagadas_con_fecha);
        const probabilityDisplay = probability === null ? 'Sin historial' : `${statisticsNumber(probability)}%`;
        const badgeClass = client.clasificacion === 'Probable pago a tiempo' ? 'on-time'
          : client.clasificacion === 'Requiere seguimiento' ? 'late' : 'reminded';
        return `<tr><td><div class="invoice-customer"><strong>${escapeHtml(client.nombre_razon_social)}</strong><small>${escapeHtml(client.cedula_rif)}</small></div></td><td><div class="probability-cell"><strong>${probabilityDisplay}</strong>${probability !== null ? `<span class="probability-track"><i style="width:${Math.max(0, Math.min(100, probability))}%"></i></span>` : ''}</div></td><td>${historyCount ? `${client.pagadas_antes_vencimiento} de ${historyCount} a tiempo` : 'Sin pagos con fecha'}</td><td>${client.pagadas_despues_recordatorio}</td><td>${client.pendientes_vencidas}</td><td><span class="behavior-badge ${badgeClass}">${escapeHtml(client.clasificacion)}</span></td></tr>`;
      }).join('')
      : '<tr><td colspan="6"><div class="empty-state"><strong>No hay clientes activos</strong></div></td></tr>';
    const invoiceRows = openInvoices.length
      ? openInvoices.map((invoice) => `<tr><td class="rif-cell">${escapeHtml(invoice.numero_factura)}</td><td><div class="invoice-customer"><strong>${escapeHtml(invoice.nombre_razon_social)}</strong><small>${escapeHtml(invoice.cedula_rif)}</small></div></td><td>${formatDate(invoice.fecha_vencimiento)}</td><td class="money-cell">${formatMoney(invoice.saldo_pendiente)}</td><td>${invoice.cantidad_recordatorios ? `${invoice.cantidad_recordatorios} llamada(s)` : 'Sin llamada'}</td><td><div class="invoice-actions"><button class="button button-secondary reminder-button" type="button" data-payment-reminder="${escapeHtml(invoice.factura_id)}" ${state.recordingReminder === String(invoice.factura_id) ? 'disabled' : ''}>${state.recordingReminder === String(invoice.factura_id) ? 'Registrando...' : 'Registrar llamada'}</button><button class="button button-primary reminder-button" type="button" data-register-payment="${escapeHtml(invoice.factura_id)}" ${state.payingInvoice === String(invoice.factura_id) ? 'disabled' : ''}>${state.payingInvoice === String(invoice.factura_id) ? 'Registrando...' : 'Registrar pago'}</button></div></td></tr>`).join('')
      : '<tr><td colspan="6"><div class="empty-state"><strong>No hay facturas pendientes</strong><small>Las nuevas facturas aparecerán aquí.</small></div></td></tr>';
    const error = state.statisticsError
      ? `<div class="alert" role="alert"><span class="alert-symbol">!</span><span>${escapeHtml(state.statisticsError)}</span><button class="alert-close" type="button" data-retry-statistics>Reintentar</button></div>`
      : '';
    pageContent.innerHTML = `
      ${pageHeading('COMPORTAMIENTO DE PAGO', 'Estadística', 'Analiza el historial de pago por cliente y prioriza llamadas de seguimiento.', '<button class="button button-secondary" type="button" data-refresh-statistics>↻ Actualizar</button>')}
      ${error}
      ${state.statisticsLoading && !data ? '<section class="table-card"><div class="loading-state"><span class="spinner"></span>Cargando datos de facturas y pagos...</div></section>' : ''}
      ${data && !state.statisticsLoading ? `
        <section class="metrics" aria-label="Indicadores de comportamiento de pago">
          ${metric('Probabilidad global a tiempo', summary.probabilidad_global_a_tiempo === null ? 'Sin historial' : `${statisticsNumber(summary.probabilidad_global_a_tiempo)}%`, '↗', 'green', `${summary.facturas_pagadas_con_fecha} facturas pagadas con fecha registrada`)}
          ${metric('Pagos después de llamada', summary.pagadas_despues_recordatorio, '☎', 'amber', 'Pagados luego de registrar recordatorio')}
          ${metric('Facturas vencidas', summary.pendientes_vencidas, '!', 'red', `De ${summary.pendientes_total} facturas pendientes`)}
          ${metric('Llamadas registradas', summary.recordatorios_pendientes, '☎', 'blue', 'En facturas que aún tienen saldo')}
        </section>
        <section class="statistics-result-card"><h2>Cómo se comportan los pagos</h2><p class="statistics-note">Conteo de facturas pagadas según su historial y las llamadas registradas.</p>${historyChart}<p class="statistics-caution">La probabilidad por cliente es su frecuencia histórica de pagos dentro del vencimiento; no garantiza el comportamiento futuro. Las facturas pagadas antiguas sin fecha de abono se muestran aparte y no se usan en el cálculo.</p></section>
        <section class="table-card"><div class="table-heading"><div><h2>Probabilidad e historial por cliente</h2><p>El cálculo usa pagos completos con fecha y muestra cuántos respaldan cada estimación.</p></div><span class="record-count">${clients.length} clientes</span></div><div class="table-wrap"><table><thead><tr><th>CLIENTE</th><th>PROB. A TIEMPO</th><th>HISTORIAL PUNTUAL</th><th>DESPUÉS DE LLAMADA</th><th>VENCIDAS</th><th>CLASIFICACIÓN</th></tr></thead><tbody>${clientRows}</tbody></table></div><p class="statistics-caution">Para una clasificación por probabilidad se requieren al menos 2 pagos con fecha: 80% o más = probable pago a tiempo; 50% a 79,9% = seguimiento preventivo; menos de 50% = requiere seguimiento. Cualquier factura vencida también requiere seguimiento, aunque el historial sea insuficiente.</p></section>
        <section class="table-card"><div class="table-heading"><div><h2>Facturas que requieren seguimiento</h2><p>Registra llamadas y pagos para actualizar el historial real.</p></div><span class="record-count">${openInvoices.length} facturas</span></div><div class="table-wrap"><table><thead><tr><th>FACTURA</th><th>CLIENTE</th><th>VENCIMIENTO</th><th>SALDO</th><th>RECORDATORIOS</th><th>ACCIONES</th></tr></thead><tbody>${invoiceRows}</tbody></table></div></section>
        <details class="statistics-manual"><summary>Análisis estadístico manual</summary>${renderManualStatistics()}</details>` : ''}
    `;
  }

  function statisticsNumber(value) {
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 }).format(Number(value));
  }

  async function loadPaymentBehavior() {
    state.statisticsLoading = true;
    state.statisticsError = '';
    if (state.view === 'estadistica') renderStatistics();
    try {
      state.paymentBehavior = (await apiRequest('/estadisticas/pagos')).data;
    } catch (error) {
      state.statisticsError = error.message;
    } finally {
      state.statisticsLoading = false;
      if (state.view === 'estadistica') renderStatistics();
    }
  }

  async function registerPaymentReminder(invoiceId) {
    const invoice = state.paymentBehavior?.clients
      .flatMap((client) => client.facturas_pendientes)
      .find((item) => String(item.factura_id) === String(invoiceId));
    if (!invoice || !window.confirm(`¿Registrar que se llamó al cliente por la factura ${invoice.numero_factura}?`)) return;
    state.recordingReminder = String(invoiceId);
    renderStatistics();
    try {
      const response = await apiRequest(`/cuentas-por-cobrar/${encodeURIComponent(invoiceId)}/recordatorios`, {
        method: 'POST',
      });
      showToast(response.message || 'Llamada registrada.');
      await loadPaymentBehavior();
    } catch (error) {
      state.statisticsError = error.message;
    } finally {
      state.recordingReminder = null;
      if (state.view === 'estadistica') renderStatistics();
    }
  }

  function openBehaviorPayment(invoiceId) {
    const invoice = state.paymentBehavior?.clients
      .flatMap((client) => client.facturas_pendientes)
      .find((item) => String(item.factura_id) === String(invoiceId));
    if (!invoice) return;
    paymentForm.reset();
    paymentForm.elements.namedItem('monto').max = Number(invoice.saldo_pendiente).toFixed(2);
    paymentForm.elements.namedItem('monto').value = Number(invoice.saldo_pendiente).toFixed(2);
    document.querySelector('#payment-invoice-summary').textContent =
      `${invoice.numero_factura} · Saldo: ${formatMoney(invoice.saldo_pendiente)}`;
    document.querySelector('#payment-form-error').textContent = '';
    paymentForm.dataset.invoiceId = invoice.factura_id;
    paymentDialog.showModal();
    paymentForm.elements.namedItem('monto').focus();
  }

  async function submitBehaviorPayment(event) {
    event.preventDefault();
    const invoiceId = paymentForm.dataset.invoiceId;
    if (state.payingInvoice) return;
    const invoice = state.paymentBehavior?.clients
      .flatMap((client) => client.facturas_pendientes)
      .find((item) => String(item.factura_id) === String(invoiceId));
    const amount = Number(new FormData(paymentForm).get('monto'));
    const errorNode = document.querySelector('#payment-form-error');
    errorNode.textContent = '';
    if (!invoice || !Number.isFinite(amount) || amount <= 0 || amount > Number(invoice.saldo_pendiente)) {
      errorNode.textContent = 'Ingresa un abono mayor que cero y no superior al saldo pendiente.';
      return;
    }
    state.payingInvoice = String(invoiceId);
    const submitButton = document.querySelector('#payment-submit');
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';
    try {
      const response = await apiRequest(`/cuentas-por-cobrar/${encodeURIComponent(invoiceId)}/abonos`, {
        method: 'POST',
        body: JSON.stringify({ monto: amount }),
      });
      paymentDialog.close();
      showToast(response.message || 'Abono registrado.');
      await loadPaymentBehavior();
    } catch (error) {
      errorNode.textContent = error.message;
    } finally {
      state.payingInvoice = null;
      submitButton.disabled = false;
      submitButton.textContent = 'Registrar abono';
      if (state.view === 'estadistica') renderStatistics();
    }
  }

  function renderManualStatistics() {
    let results = '';
    let error = '';
    try {
      results = renderStatisticsResults(state.statistics.x, state.statistics.y);
    } catch (analysisError) {
      error = `<p class="statistics-error" role="alert">${escapeHtml(analysisError.message)}</p>`;
    }
    pageContent.innerHTML = `
      ${pageHeading('ANÁLISIS DE DATOS', 'Estadística', 'Pega tus datos para calcular medidas, crear una distribución y explorar la relación entre dos variables.')}
      <form class="statistics-input-card" id="statistics-form">
        <div class="statistics-input-heading"><div><h2>Conjunto de datos</h2><p>Separa los valores con espacios, comas, punto y coma o saltos de línea. Usa punto para decimales.</p></div><button class="button button-secondary" type="button" data-statistics-example>Cargar ejemplo</button></div>
        <div class="statistics-inputs">
          <label class="form-field">Variable X
            <textarea name="statistics_x" rows="4" placeholder="Ej.: 1, 2, 3, 4, 5" required>${escapeHtml(state.statistics.x)}</textarea>
            <small>Dato principal; se usa para la distribución.</small>
          </label>
          <label class="form-field">Variable Y (opcional)
            <textarea name="statistics_y" rows="4" placeholder="Ej.: 52, 55, 61, 65, 68">${escapeHtml(state.statistics.y)}</textarea>
            <small>Ingresa la misma cantidad de valores para calcular correlación y regresión.</small>
          </label>
        </div>
        <div class="statistics-actions"><span>Admite hasta 500 observaciones por variable.</span><button class="button button-primary" type="submit">Calcular estadísticas</button></div>
      </form>
      ${error}
      ${results}`;
  }

  function parseStatisticsValues(input, label) {
    const tokens = input.trim().split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) throw new Error(`Ingresa al menos un valor para ${label}.`);
    if (tokens.length > 500) throw new Error(`${label} admite un máximo de 500 valores.`);
    const values = tokens.map(Number);
    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Revisa ${label}: todos los datos deben ser números válidos.`);
    }
    return values;
  }

  function summarizeStatistics(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const quantile = (probability) => {
      const position = (sorted.length - 1) * probability;
      const lower = Math.floor(position);
      const fraction = position - lower;
      return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
    };
    const variance = values.length > 1
      ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
      : null;
    return {
      values,
      count: values.length,
      mean,
      median: quantile(0.5),
      standardDeviation: variance === null ? null : Math.sqrt(variance),
      q1: quantile(0.25),
      q3: quantile(0.75),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  function statisticsNumber(value) {
    return value === null
      ? 'No disponible'
      : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(value);
  }

  function renderStatisticsSummary(summary, label) {
    const measures = [
      ['Observaciones', summary.count],
      ['Media', statisticsNumber(summary.mean)],
      ['Mediana', statisticsNumber(summary.median)],
      ['Desviación estándar muestral', statisticsNumber(summary.standardDeviation)],
      ['Percentil 25 (Q1)', statisticsNumber(summary.q1)],
      ['Percentil 75 (Q3)', statisticsNumber(summary.q3)],
      ['Mínimo', statisticsNumber(summary.min)],
      ['Máximo', statisticsNumber(summary.max)],
    ];
    return `<section class="statistics-result-card"><h2>Resumen de ${label}</h2><dl class="statistics-measures">${measures.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`;
  }

  function renderStatisticsDistribution(summary) {
    const binCount = Math.min(12, Math.max(1, Math.ceil(1 + 3.322 * Math.log10(summary.count))));
    const range = summary.max - summary.min;
    const width = range === 0 ? 1 : range / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      start: summary.min + index * width,
      end: index === binCount - 1 ? summary.max : summary.min + (index + 1) * width,
      count: 0,
    }));
    summary.values.forEach((value) => {
      const index = range === 0 ? 0 : Math.min(binCount - 1, Math.floor((value - summary.min) / width));
      bins[index].count += 1;
    });
    const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
    const chart = bins.map((bin, index) => {
      const barWidth = 560 / binCount - 8;
      const x = 48 + index * (560 / binCount) + 4;
      const height = (bin.count / maxCount) * 150;
      const y = 190 - height;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="3"><title>${statisticsNumber(bin.start)}–${statisticsNumber(bin.end)}: ${bin.count}</title></rect><text x="${x + barWidth / 2}" y="210" text-anchor="middle">${statisticsNumber(bin.start)}</text>`;
    }).join('');
    const tableRows = bins.map((bin) => `<tr><td>${statisticsNumber(bin.start)} – ${statisticsNumber(bin.end)}</td><td>${bin.count}</td><td>${statisticsNumber(bin.count / summary.count * 100)} %</td></tr>`).join('');
    return `<section class="statistics-result-card"><h2>Distribución de Variable X</h2><p class="statistics-note">Histograma y tabla de frecuencias agrupadas.</p><div class="statistics-chart-wrap"><svg class="statistics-chart" viewBox="0 0 640 235" role="img" aria-label="Histograma de la variable X"><line x1="44" y1="190" x2="610" y2="190"></line><line x1="44" y1="28" x2="44" y2="190"></line>${chart}<text x="320" y="232" text-anchor="middle">Intervalos de valores</text></svg></div><div class="table-wrap"><table><thead><tr><th>Intervalo</th><th>Frecuencia</th><th>Porcentaje</th></tr></thead><tbody>${tableRows}</tbody></table></div></section>`;
  }

  function renderStatisticsRelationship(xValues, yValues) {
    if (!yValues.length) {
      return '<section class="statistics-result-card"><h2>Relación entre variables</h2><p class="statistics-note">Agrega valores en Variable Y para calcular correlación y regresión lineal.</p></section>';
    }
    if (xValues.length !== yValues.length) {
      throw new Error('Variable X y Variable Y deben tener la misma cantidad de valores.');
    }
    const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
    const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
    const xVariance = xValues.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
    const yVariance = yValues.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
    if (xVariance === 0 || yVariance === 0) {
      return '<section class="statistics-result-card"><h2>Relación entre variables</h2><p class="statistics-note">No se puede calcular la correlación: ambas variables deben tener variación.</p></section>';
    }
    const covariance = xValues.reduce((sum, value, index) => sum + (value - xMean) * (yValues[index] - yMean), 0);
    const correlation = covariance / Math.sqrt(xVariance * yVariance);
    const slope = covariance / xVariance;
    const intercept = yMean - slope * xMean;
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const xPad = (maxX - minX || 1) * 0.08;
    const yPad = (maxY - minY || 1) * 0.12;
    const x0 = minX - xPad;
    const x1 = maxX + xPad;
    const y0 = minY - yPad;
    const y1 = maxY + yPad;
    const px = (value) => 48 + (value - x0) / (x1 - x0) * 550;
    const py = (value) => 205 - (value - y0) / (y1 - y0) * 175;
    const points = xValues.map((x, index) => `<circle cx="${px(x)}" cy="${py(yValues[index])}" r="4"><title>X: ${statisticsNumber(x)}, Y: ${statisticsNumber(yValues[index])}</title></circle>`).join('');
    const line = `<line class="statistics-regression-line" x1="${px(minX)}" y1="${py(slope * minX + intercept)}" x2="${px(maxX)}" y2="${py(slope * maxX + intercept)}"></line>`;
    return `<section class="statistics-result-card"><h2>Correlación y regresión lineal</h2><p class="statistics-note">Cada par de valores en la misma posición se considera una observación.</p><div class="statistics-chart-wrap"><svg class="statistics-chart statistics-scatter" viewBox="0 0 640 235" role="img" aria-label="Diagrama de dispersión y línea de regresión"><line x1="44" y1="205" x2="610" y2="205"></line><line x1="44" y1="25" x2="44" y2="205"></line>${line}${points}<text x="320" y="232" text-anchor="middle">Variable X</text><text x="15" y="18">Variable Y</text></svg></div><dl class="statistics-regression"><div><dt>Correlación de Pearson (r)</dt><dd>${statisticsNumber(correlation)}</dd></div><div><dt>Coeficiente de determinación (R²)</dt><dd>${statisticsNumber(correlation ** 2)}</dd></div><div><dt>Recta estimada</dt><dd>Y = ${statisticsNumber(slope)} × X ${intercept < 0 ? '−' : '+'} ${statisticsNumber(Math.abs(intercept))}</dd></div></dl><p class="statistics-caution">La correlación indica asociación, no demuestra que una variable cause la otra.</p></section>`;
  }

  function renderStatisticsResults(xInput, yInput) {
    const xValues = parseStatisticsValues(xInput, 'Variable X');
    const yValues = yInput.trim() ? parseStatisticsValues(yInput, 'Variable Y') : [];
    if (yValues.length && yValues.length !== xValues.length) {
      throw new Error('Variable X y Variable Y deben tener la misma cantidad de valores.');
    }
    const xSummary = summarizeStatistics(xValues);
    const ySummary = yValues.length ? summarizeStatistics(yValues) : null;
    return `<div class="statistics-results"><section class="statistics-summaries">${renderStatisticsSummary(xSummary, 'Variable X')}${ySummary ? renderStatisticsSummary(ySummary, 'Variable Y') : ''}</section>${renderStatisticsDistribution(xSummary)}${renderStatisticsRelationship(xValues, yValues)}</div>`;
  }

  function renderClients() {
    const clients = state.clientResult?.data || [];
    const pagination = state.clientResult?.pagination || {
      pagina: state.page, tamano_pagina: state.pageSize, total: 0, total_paginas: 0,
    };
    const clientRows = state.loading
      ? loadingRow(8, 'Cargando clientes...')
      : state.error && !state.clientResult
        ? emptyRow(8, 'No se pudieron cargar los clientes', 'Revisa la conexión con el servidor y vuelve a intentarlo.')
        : clients.length === 0
          ? emptyRow(8, 'No hay clientes para este filtro', 'Registra un cliente o cambia la búsqueda y el estado.')
          : clients.map((client) => `
            <tr>
              <td><div class="client-cell"><span class="client-avatar">${escapeHtml(client.nombre_razon_social.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(client.nombre_razon_social)}</strong><small>${escapeHtml(client.direccion)}</small></span></div></td>
              <td class="rif-cell">${escapeHtml(client.cedula_rif)}</td>
              <td>${escapeHtml(client.telefono)}</td>
              <td class="money-cell">${formatMoney(client.limite_credito)}</td>
              <td>${escapeHtml(client.dias_credito_otorgados)} días</td>
              <td>${escapeHtml(client.estado)}</td>
              <td>${formatDate(client.fecha_creacion)}</td>
              <td>${client.estado === 'ACTIVO' ? `<div class="row-actions">
                <button class="icon-button" type="button" data-edit-client="${escapeHtml(client.id)}" aria-label="Editar ${escapeHtml(client.nombre_razon_social)}" title="Editar">✎</button>
                <button class="icon-button danger" type="button" data-delete-client="${escapeHtml(client.id)}" ${state.deletingId === client.id ? 'disabled' : ''} aria-label="Inactivar ${escapeHtml(client.nombre_razon_social)}" title="Inactivar">⌫</button>
              </div>` : '—'}</td>
            </tr>`).join('');
    const visibleCredit = clients.reduce((total, client) => total + Number(client.limite_credito || 0), 0);
    const errorBanner = state.error ? showError(state.error) : '';

    pageContent.innerHTML = `
      ${pageHeading('MÓDULO A · MAESTRO DE DATOS', 'Gestión de clientes', 'Administra clientes y sus condiciones de crédito.',
        '<button class="button button-primary" type="button" data-new-client><span>＋</span> Nuevo cliente</button>')}
      ${errorBanner}
      <section class="metrics compact-metrics" aria-label="Resumen de clientes">
        ${metric('Clientes encontrados', state.loading || state.error && !state.clientResult ? '—' : pagination.total, '▦', 'purple', `Filtro: ${state.clientStatus.toLowerCase()}`)}
        ${metric('Página actual', `${pagination.pagina} / ${Math.max(pagination.total_paginas, 1)}`, '↕', 'blue', `${pagination.tamano_pagina} registros por página`)}
        ${metric('Límite visible', formatMoney(visibleCredit), '$', 'green', 'Suma de la página actual')}
      </section>
      <section class="table-card">
        <div class="table-heading"><div><h2>Directorio de clientes</h2><p>Buscar, editar y cambiar el estado de los registros.</p></div><span class="record-count">${pagination.total} registros</span></div>
        <div class="filters"><label class="search-box"><span>⌕</span><input id="client-search" value="${escapeHtml(state.search)}" placeholder="Buscar por cédula/RIF o razón social..." aria-label="Buscar clientes">${state.search ? '<button type="button" data-clear-search aria-label="Limpiar búsqueda">×</button>' : ''}</label><label class="filter-select">Estado<select id="client-status"><option value="ACTIVO" ${state.clientStatus === 'ACTIVO' ? 'selected' : ''}>Activos</option><option value="INACTIVO" ${state.clientStatus === 'INACTIVO' ? 'selected' : ''}>Inactivos</option><option value="TODOS" ${state.clientStatus === 'TODOS' ? 'selected' : ''}>Todos</option></select></label></div>
        <div class="table-wrap"><table>
          <thead><tr><th>CLIENTE</th><th>CÉDULA / RIF</th><th>TELÉFONO</th><th>LÍMITE CRÉDITO</th><th>DÍAS CRÉDITO</th><th>ESTADO</th><th>REGISTRO</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>${clientRows}</tbody>
        </table></div>
        <footer class="pagination">
          <span>Mostrando ${clients.length ? (pagination.pagina - 1) * pagination.tamano_pagina + 1 : 0}–${Math.min(pagination.pagina * pagination.tamano_pagina, pagination.total)} de ${pagination.total}</span>
          <div class="pagination-controls">
            <button class="button button-secondary" type="button" data-page="${pagination.pagina - 1}" ${state.loading || pagination.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
            <span class="page-indicator">${pagination.pagina} / ${Math.max(pagination.total_paginas, 1)}</span>
            <button class="button button-secondary" type="button" data-page="${pagination.pagina + 1}" ${state.loading || pagination.pagina >= pagination.total_paginas ? 'disabled' : ''}>Siguiente</button>
          </div>
        </footer>
      </section>`;
  }

  async function loadClients() {
    state.loading = true;
    state.error = '';
    renderClients();
    try {
      state.clientResult = await apiRequest(`/clientes${queryString({
        pagina: state.page,
        tamano_pagina: state.pageSize,
        busqueda: state.search.trim(),
        estado: state.clientStatus,
      })}`);
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      if (state.view === 'clientes') renderClients();
    }
  }

  function clientFieldError(name, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (name === 'cedula_rif' && !/^[VEJPG]-?\d{5,10}$/i.test(value)) {
      return 'Usa un formato válido, por ejemplo V-12345678.';
    }
    if (name === 'nombre_razon_social' && (value.length < 2 || value.length > 180)) {
      return 'El nombre o razón social debe tener entre 2 y 180 caracteres.';
    }
    if (name === 'telefono' && !/^\+?[\d\s().-]{7,25}$/.test(value)) {
      return 'Ingresa un teléfono válido.';
    }
    if (name === 'direccion' && (value.length < 3 || value.length > 2000)) {
      return 'La dirección debe tener entre 3 y 2000 caracteres.';
    }
    if (name === 'limite_credito'
      && (!value || !Number.isFinite(Number(value)) || Number(value) < 0)) {
      return 'El límite debe ser cero o mayor.';
    }
    if (name === 'dias_credito_otorgados'
      && (!value || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 3650)) {
      return 'Indica días entre 0 y 3650.';
    }
    return '';
  }

  function validateClientForm() {
    const data = new FormData(clientForm);
    const fields = [
      'cedula_rif',
      'nombre_razon_social',
      'telefono',
      'direccion',
      'limite_credito',
      'dias_credito_otorgados',
    ];
    const errors = Object.fromEntries(fields
      .map((field) => [field, clientFieldError(field, data.get(field))])
      .filter(([, message]) => message));
    clientForm.querySelectorAll('[data-error-for]').forEach((node) => {
      node.textContent = errors[node.dataset.errorFor] || '';
      node.previousElementSibling?.setAttribute('aria-invalid', String(Boolean(errors[node.dataset.errorFor])));
    });
    return { errors, data };
  }

  async function submitClient(event) {
    event.preventDefault();
    if (state.saving) return;
    const { errors, data } = validateClientForm();
    const errorNode = document.querySelector('#client-form-error');
    errorNode.textContent = '';
    if (Object.keys(errors).length) return;

    const submitButton = document.querySelector('#client-submit');
    state.saving = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';
    try {
      const payload = {
        cedula_rif: String(data.get('cedula_rif')).trim().toUpperCase(),
        nombre_razon_social: String(data.get('nombre_razon_social')).trim(),
        telefono: String(data.get('telefono')).trim(),
        direccion: String(data.get('direccion')).trim(),
        limite_credito: Number(data.get('limite_credito')),
        dias_credito_otorgados: Number(data.get('dias_credito_otorgados')),
      };
      const path = state.editingClientId
        ? `/clientes/${state.editingClientId}`
        : '/clientes';
      const response = await apiRequest(path, {
        method: state.editingClientId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      clientDialog.close();
      showToast(response.message || 'Cliente guardado correctamente.');
      if (!state.editingClientId) state.page = 1;
      await loadClients();
    } catch (error) {
      errorNode.textContent = error.details?.length
        ? `${error.message} ${error.details.map((detail) => detail.message).join(' ')}`
        : error.message;
    } finally {
      state.saving = false;
      submitButton.disabled = false;
      submitButton.textContent = state.editingClientId ? 'Guardar cambios' : 'Crear cliente';
    }
  }

  async function editClient(id) {
    try {
      const response = await apiRequest(`/clientes/${encodeURIComponent(id)}`);
      const client = response.data;
      state.editingClientId = client.id;
      clientForm.reset();
      Object.entries(client).forEach(([key, value]) => {
        const input = clientForm.elements.namedItem(key);
        if (input && value !== null && value !== undefined) input.value = value;
      });
      document.querySelector('#client-dialog-eyebrow').textContent = 'ACTUALIZACIÓN';
      document.querySelector('#client-dialog-title').textContent = 'Editar cliente';
      document.querySelector('#client-submit').textContent = 'Guardar cambios';
      clientDialog.showModal();
    } catch (error) {
      state.error = error.message;
      renderClients();
    }
  }

  async function deleteClient(id) {
    const client = state.clientResult?.data.find((record) => String(record.id) === String(id));
    if (!client) return;
    const confirmationDialog = document.querySelector('#confirm-delete-dialog');
    confirmationDialog.returnValue = 'cancelar';
    document.querySelector('#confirm-delete-name').textContent = client.nombre_razon_social;
    confirmationDialog.showModal();
    const confirmed = await new Promise((resolve) => {
      confirmationDialog.addEventListener('close', () => {
        resolve(confirmationDialog.returnValue === 'confirmar');
      }, { once: true });
    });
    if (!confirmed) return;
    state.deletingId = client.id;
    renderClients();
    try {
      const response = await apiRequest(`/clientes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      showToast(response.message || 'Cliente inactivado correctamente.');
      if (state.clientResult.data.length === 1 && state.page > 1) state.page -= 1;
      await loadClients();
    } catch (error) {
      state.error = error.message;
      renderClients();
    } finally {
      state.deletingId = null;
    }
  }

  function renderProducts() {
    const productData = state.products;
    const errorBanner = state.error ? showError(state.error) : '';
    const visibleProducts = (productData?.productos || []).filter((product) => (
      state.productCategory === '' || String(product.categoria_id) === state.productCategory
    ));
    const rows = state.loading
      ? loadingRow(7, 'Cargando productos...')
      : state.error && !productData
        ? emptyRow(7, 'No se pudo cargar el catálogo', 'Revisa la conexión y vuelve a intentarlo.')
        : !visibleProducts.length
          ? emptyRow(7, 'No hay productos para esta categoría', 'Cambia el filtro o revisa los productos registrados en la base de datos.')
          : visibleProducts.map((product) => `
            <tr>
              <td class="rif-cell">${escapeHtml(product.codigo)}</td><td class="product-name">${escapeHtml(product.nombre)}</td>
              <td>${escapeHtml(product.categoria)}</td><td class="money-cell">${formatMoney(product.precio_usd, 'USD')}</td>
              <td class="money-cell">${formatMoney(product.precio_bs)}</td>
              <td>${Number(product.tasa_cambio).toLocaleString('es-VE', { maximumFractionDigits: 6 })}</td>
              <td>${formatDate(product.fecha_actualizacion)}</td>
            </tr>`).join('');
    const categories = productData?.categorias || [];
    const categoryOptions = categories.map((category) => (
      `<option value="${escapeHtml(category.id)}" ${String(category.id) === state.priceForm.categoria_id ? 'selected' : ''}>${escapeHtml(category.nombre)}</option>`
    )).join('');
    const tableCategoryOptions = categories.map((category) => (
      `<option value="${escapeHtml(category.id)}" ${String(category.id) === state.productCategory ? 'selected' : ''}>${escapeHtml(category.nombre)}</option>`
    )).join('');
    const priceLabel = state.priceForm.modo === 'porcentaje' ? 'Incremento porcentual (%)' : 'Nueva tasa (Bs por USD)';
    const pricePlaceholder = state.priceForm.modo === 'porcentaje' ? 'Ej. 12.5' : 'Ej. 36.500000';
    const modeHelp = state.priceForm.modo === 'porcentaje'
      ? 'El porcentaje incrementa simultáneamente los precios en USD y bolívares.'
      : 'Se conserva el precio USD y se recalcula el equivalente en bolívares.';

    pageContent.innerHTML = `
      ${pageHeading('MÓDULO B · AUTOMATIZACIÓN', 'Ajuste masivo de precios', 'Recalcula precios de productos con una actualización transaccional.')}
      ${errorBanner}
      <div class="price-layout">
        <section class="table-card">
          <div class="table-heading"><div><h2>Actualizar precios</h2><p>Los productos se cargan desde la API; no hay precios de demostración.</p></div></div>
          <form class="price-form" id="price-form">
            <label class="form-field">Método de actualización
              <select name="modo">
                <option value="tasa_cambio" ${state.priceForm.modo === 'tasa_cambio' ? 'selected' : ''}>Nueva tasa de cambio (Bs/USD)</option>
                <option value="porcentaje" ${state.priceForm.modo === 'porcentaje' ? 'selected' : ''}>Porcentaje de incremento (%)</option>
              </select>
            </label>
            <label class="form-field">${priceLabel}
              <input name="valor" type="number" min="0.000001" step="${state.priceForm.modo === 'porcentaje' ? '0.01' : '0.000001'}" max="${state.priceForm.modo === 'porcentaje' ? '1000' : '99999999.999999'}" value="${escapeHtml(state.priceForm.valor)}" placeholder="${pricePlaceholder}" required>
            </label>
            <label class="form-field">Categoría
              <select name="categoria_id"><option value="">Todos los productos activos</option>${categoryOptions}</select>
            </label>
            <div class="price-help">${modeHelp}</div>
            <button class="button button-primary" type="submit" ${state.loading || state.savingPrices || !productData?.productos.length ? 'disabled' : ''}>${state.savingPrices ? 'Actualizando...' : 'Aplicar actualización masiva'}</button>
          </form>
        </section>
        <article class="metric-card product-count-card"><div class="metric-top"><span>Productos activos</span><span class="metric-icon purple">▦</span></div><strong>${state.loading || state.error && !productData ? '—' : productData?.productos.length || 0}</strong><small>Resultados recibidos de la API</small></article>
      </div>
      <section class="table-card">
        <div class="table-heading"><div><h2>Catálogo de productos</h2><p>Precios registrados en bolívares y dólares.</p></div><label class="filter-select">Categoría<select id="product-category"><option value="">Todas</option>${tableCategoryOptions}</select></label></div>
        <div class="table-wrap"><table>
          <thead><tr><th>CÓDIGO</th><th>PRODUCTO</th><th>CATEGORÍA</th><th>PRECIO USD</th><th>PRECIO BS</th><th>TASA BS/USD</th><th>ACTUALIZADO</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </section>`;
  }

  async function loadProducts() {
    state.loading = true;
    state.error = '';
    renderProducts();
    try {
      state.products = await apiRequest('/productos').then((response) => response.data);
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      if (state.view === 'precios') renderProducts();
    }
  }

  async function submitPrices(event) {
    event.preventDefault();
    if (state.savingPrices) return;
    const form = new FormData(event.currentTarget);
    const mode = String(form.get('modo'));
    const value = Number(form.get('valor'));
    const categoryId = String(form.get('categoria_id') || '');
    const max = mode === 'porcentaje' ? 1000 : 99999999.999999;
    if (!Number.isFinite(value) || value <= 0 || value > max) {
      state.error = mode === 'porcentaje'
        ? 'Ingresa un incremento mayor a cero y no superior a 1000%.'
        : 'Ingresa una tasa de cambio válida mayor a cero.';
      renderProducts();
      return;
    }
    const category = state.products?.categorias.find((item) => String(item.id) === categoryId);
    const scope = category ? `la categoría «${category.nombre}»` : 'todos los productos activos';
    const unit = mode === 'porcentaje' ? '%' : 'Bs/USD';
    if (!window.confirm(`¿Deseas aplicar ${value} ${unit} a ${scope}? La acción actualizará los precios en la base de datos.`)) return;

    state.priceForm = { modo: mode, valor: String(form.get('valor')), categoria_id: categoryId };
    state.savingPrices = true;
    state.error = '';
    renderProducts();
    try {
      const response = await apiRequest('/productos/actualizar-precios-masivo', {
        method: 'POST',
        body: JSON.stringify({
          modo: mode,
          valor: value,
          ...(categoryId ? { categoria_id: Number(categoryId) } : {}),
        }),
      });
      showToast(response.message || 'Los precios se actualizaron correctamente.');
      await loadProducts();
    } catch (error) {
      state.error = error.message;
    } finally {
      state.savingPrices = false;
      if (state.view === 'precios') renderProducts();
    }
  }

  function renderReceivables() {
    const data = state.receivables;
    const invoices = data?.invoices || [];
    const alerts = state.alerts || [];
    const errorBanner = state.error ? showError(state.error) : '';
    const rows = state.loading
      ? loadingRow(7, 'Cargando cuentas por cobrar...')
      : state.error && !data
        ? emptyRow(7, 'No se pudieron cargar las facturas', 'Revisa la conexión y vuelve a intentarlo.')
        : invoices.length === 0
          ? emptyRow(7, 'No hay facturas pendientes', 'Las facturas con saldo se consultan desde la base de datos.')
          : invoices.map((invoice) => invoiceTableRow(invoice)).join('');
    const alertItems = state.loading
      ? '<div class="loading-state"><span class="spinner"></span>Consultando vencimientos...</div>'
      : state.error && !state.alerts
        ? '<div class="inline-error">No se pudieron consultar las alertas. Revisa la conexión y vuelve a intentarlo.</div>'
        : alerts.length
          ? alerts.map((invoice) => invoiceAlertRow(invoice)).join('')
          : '<div class="no-alerts"><span>✓</span><strong>Sin alertas próximas</strong><small>No hay facturas vencidas o próximas a vencer para este período.</small></div>';
    const summary = data?.summary;

    pageContent.innerHTML = `
      ${pageHeading('MÓDULO B · CRÉDITO Y COBRANZA', 'Cuentas por cobrar', 'Facturas pendientes, vencimientos y alertas para cobranza.',
        `<label class="days-filter">Alertar con hasta <select id="alert-days"><option value="3" ${state.alertDays === 3 ? 'selected' : ''}>3 días</option><option value="7" ${state.alertDays === 7 ? 'selected' : ''}>7 días</option><option value="14" ${state.alertDays === 14 ? 'selected' : ''}>14 días</option><option value="30" ${state.alertDays === 30 ? 'selected' : ''}>30 días</option></select> de anticipación</label>`)}
      ${errorBanner}
      <section class="metrics" aria-label="Resumen de cuentas por cobrar">
        ${metric('Facturas pendientes', state.loading || state.error && !data ? '—' : summary?.facturas_pendientes ?? 0, '▤', 'purple', 'Facturas con saldo pendiente')}
        ${metric('Saldo por cobrar', state.loading || state.error && !data ? '—' : formatMoney(summary?.saldo_total), '$', 'blue', 'Saldo acumulado')}
        ${metric('Facturas vencidas', state.loading || state.error && !data ? '—' : summary?.vencidas ?? 0, '!', 'red', 'Fecha de vencimiento superada')}
        ${metric('Por vencer en 7 días', state.loading || state.error && !data ? '—' : summary?.por_vencer ?? 0, '◷', 'amber', 'Próximos siete días')}
      </section>
      <section class="alert-panel">
        <div class="alert-panel-title"><span class="metric-icon amber">!</span><div><strong>Alertas de vencimiento</strong><small>Vencidas o próximas a vencer en ${state.alertDays} días</small></div><span class="record-count">${state.loading || state.error && !state.alerts ? '— alertas' : `${alerts.length} alertas`}</span></div>
        <div class="alert-list">${alertItems}</div>
      </section>
      <section class="table-card">
        <div class="table-heading"><div><h2>Facturas pendientes</h2><p>El indicador de vencimiento se calcula con la fecha del servidor.</p></div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>FACTURA</th><th>CLIENTE</th><th>EMISIÓN</th><th>VENCIMIENTO</th><th>TOTAL</th><th>SALDO</th><th>ALERTA</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </section>`;
  }

  function invoiceStatus(invoice) {
    if (invoice.alerta === 'VENCIDO' || invoice.estatus_pago === 'VENCIDO') return 'vencido';
    if (invoice.alerta === 'POR_VENCER') return 'por_vencer';
    return 'al_dia';
  }

  function invoiceStatusLabel(invoice) {
    const status = invoiceStatus(invoice);
    return status === 'vencido' ? 'VENCIDO' : status === 'por_vencer' ? 'POR VENCER' : 'AL DÍA';
  }

  function invoiceTableRow(invoice) {
    const status = invoiceStatus(invoice);
    return `<tr><td class="rif-cell">${escapeHtml(invoice.numero_factura)}</td><td><div class="invoice-customer"><strong>${escapeHtml(invoice.nombre_razon_social)}</strong><small>${escapeHtml(invoice.cedula_rif)}</small></div></td><td>${formatDate(invoice.fecha_emision)}</td><td>${formatDate(invoice.fecha_vencimiento)}</td><td class="money-cell">${formatMoney(invoice.monto_total)}</td><td class="money-cell">${formatMoney(invoice.saldo_pendiente)}</td><td><span class="status-pill ${status}">${invoiceStatusLabel(invoice)}</span></td></tr>`;
  }

  function invoiceAlertRow(invoice) {
    const status = invoiceStatus(invoice);
    const due = status === 'vencido'
      ? `Vencida hace ${Math.abs(Number(invoice.dias_hasta_vencimiento))} días`
      : `Vence ${formatDate(invoice.fecha_vencimiento)}`;
    return `<div class="invoice-alert ${status}"><span class="alert-status-dot ${status}"></span><span class="invoice-alert-main"><strong>${escapeHtml(invoice.numero_factura)}</strong><small>${escapeHtml(invoice.nombre_razon_social)} · ${escapeHtml(invoice.cedula_rif)}</small></span><span class="invoice-alert-amount">${formatMoney(invoice.saldo_pendiente)}</span><span class="invoice-alert-due">${due}</span></div>`;
  }

  async function loadReceivables() {
    state.loading = true;
    state.error = '';
    renderReceivables();
    try {
      const query = queryString({ dias: state.alertDays });
      const [dashboard, alertResponse] = await Promise.all([
        apiRequest(`/cuentas-por-cobrar${query}`),
        apiRequest(`/cuentas-por-cobrar/alertas${query}`),
      ]);
      state.receivables = dashboard.data;
      state.alerts = alertResponse.data;
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      if (state.view === 'deudas') renderReceivables();
    }
  }

  function openNewClient() {
    state.editingClientId = null;
    clientForm.reset();
    document.querySelector('#client-dialog-eyebrow').textContent = 'NUEVO REGISTRO';
    document.querySelector('#client-dialog-title').textContent = 'Registrar cliente';
    document.querySelector('#client-submit').textContent = 'Crear cliente';
    document.querySelector('#client-form-error').textContent = '';
    clientForm.querySelectorAll('[data-error-for]').forEach((node) => { node.textContent = ''; });
    clientDialog.showModal();
    clientForm.elements.namedItem('cedula_rif').focus();
  }

  document.addEventListener('click', (event) => {
    const menuToggle = event.target.closest('[data-menu-toggle]');
    if (menuToggle) {
      const sidebar = document.querySelector('.sidebar');
      const expanded = sidebar.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(expanded));
      menuToggle.setAttribute('aria-label', expanded ? 'Cerrar menú' : 'Abrir menú');
      return;
    }
    if (event.target.closest('[data-logout]')) {
      apiRequest('/autenticacion/cerrar-sesion', { method: 'POST' })
        .then(() => window.location.replace('./login.html'))
        .catch((error) => {
          state.error = error.message;
          render();
        });
      return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      document.querySelector('.sidebar').classList.remove('is-open');
      const menuButton = document.querySelector('[data-menu-toggle]');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Abrir menú');
      state.view = viewButton.dataset.view;
      state.loading = false;
      state.error = '';
      render();
      if (state.view === 'clientes' && !state.clientResult) loadClients();
      if (state.view === 'precios' && !state.products) loadProducts();
      if (state.view === 'deudas' && !state.receivables) loadReceivables();
      if (state.view === 'estadistica') loadPaymentBehavior();
      return;
    }
    if (event.target.closest('[data-refresh-statistics]') || event.target.closest('[data-retry-statistics]')) {
      loadPaymentBehavior();
      return;
    }
    const reminderButton = event.target.closest('[data-payment-reminder]');
    if (reminderButton) {
      registerPaymentReminder(reminderButton.dataset.paymentReminder);
      return;
    }
    const paymentButton = event.target.closest('[data-register-payment]');
    if (paymentButton) {
      openBehaviorPayment(paymentButton.dataset.registerPayment);
      return;
    }
    if (event.target.closest('[data-statistics-example]')) {
      state.statistics.x = '1 2 3 4 5 6 7 8';
      state.statistics.y = '52 55 61 65 68 72 75 81';
      renderStatistics();
      return;
    }
    if (event.target.closest('[data-new-client]')) {
      openNewClient();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) {
      clientDialog.close();
      return;
    }
    if (event.target.closest('[data-close-payment]')) {
      paymentDialog.close();
      return;
    }
    const editButton = event.target.closest('[data-edit-client]');
    if (editButton) {
      editClient(editButton.dataset.editClient);
      return;
    }
    const deleteButton = event.target.closest('[data-delete-client]');
    if (deleteButton) {
      deleteClient(deleteButton.dataset.deleteClient);
      return;
    }
    const pageButton = event.target.closest('[data-page]');
    if (pageButton && !pageButton.disabled) {
      state.page = Number(pageButton.dataset.page);
      loadClients();
      return;
    }
    if (event.target.closest('[data-clear-search]')) {
      state.search = '';
      state.page = 1;
      loadClients();
      return;
    }
    if (event.target.closest('[data-retry]')) {
      if (state.view === 'clientes') loadClients();
      if (state.view === 'precios') loadProducts();
      if (state.view === 'deudas') loadReceivables();
    }
  });

  pageContent.addEventListener('input', (event) => {
    if (event.target.id !== 'client-search') return;
    state.search = event.target.value;
    state.page = 1;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => loadClients(), 300);
  });

  pageContent.addEventListener('change', (event) => {
    if (event.target.id === 'client-status') {
      state.clientStatus = event.target.value;
      state.page = 1;
      loadClients();
    }
    if (event.target.id === 'product-category') {
      state.productCategory = event.target.value;
      renderProducts();
    }
    if (event.target.id === 'alert-days') {
      state.alertDays = Number(event.target.value);
      loadReceivables();
    }
    if (event.target.name === 'modo' && event.target.closest('#price-form')) {
      state.priceForm.modo = event.target.value;
      const form = document.querySelector('#price-form');
      state.priceForm.valor = form.elements.namedItem('valor').value;
      state.priceForm.categoria_id = form.elements.namedItem('categoria_id').value;
      renderProducts();
    }
    if (event.target.closest('#price-form') && event.target.name === 'categoria_id') {
      state.priceForm.categoria_id = event.target.value;
    }
    if (event.target.closest('#price-form') && event.target.name === 'valor') {
      state.priceForm.valor = event.target.value;
    }
  });

  pageContent.addEventListener('submit', (event) => {
    if (event.target.id === 'statistics-form') {
      event.preventDefault();
      state.statistics.x = event.target.elements.namedItem('statistics_x').value;
      state.statistics.y = event.target.elements.namedItem('statistics_y').value;
      renderStatistics();
    }
    if (event.target.id === 'price-form') submitPrices(event);
  });
  clientForm.addEventListener('submit', submitClient);
  paymentForm.addEventListener('submit', submitBehaviorPayment);
  clientForm.addEventListener('input', (event) => {
    if (!event.target.name) return;
    const fieldError = clientForm.querySelector(`[data-error-for="${event.target.name}"]`);
    const message = clientFieldError(event.target.name, event.target.value);
    if (fieldError) fieldError.textContent = message;
    event.target.setAttribute('aria-invalid', String(Boolean(message)));
  });
  clientDialog.addEventListener('click', (event) => {
    if (event.target === clientDialog) clientDialog.close();
  });
  paymentDialog.addEventListener('click', (event) => {
    if (event.target === paymentDialog) paymentDialog.close();
  });

  render();
  verifySession();
})();
