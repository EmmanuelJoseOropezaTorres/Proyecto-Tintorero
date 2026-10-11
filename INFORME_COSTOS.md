# Informe de valoración de costos — Valery

## 1. Datos y alcance

Se valora el módulo académico del portal Valery con la metodología de siete pasos solicitada. El equipo informó un total de **20 horas de programación**. Para aplicar el mismo método del proyecto de café, se toman de ese informe como parámetros de referencia la remuneración mensual de **USD 500**, los costos operativos mensuales de **USD 35,03**, el equipo de **USD 570**, la jornada de **176 horas mensuales** y **2.112 horas anuales**, con desgaste/contingencia de **20 %**.

Los importes son una valoración académica en USD, no una cotización comercial ni un registro contable. El total de 20 horas fue informado por el equipo y se usa para calcular el costo del proyecto. A petición del equipo, el total se distribuyó entre las cinco tarjetas del Kanban; el reparto por actividad es una asignación acordada, no una bitácora individual cronometrada.

## 2. Insumos digitales

| Insumo | Costo imputado |
|---|---:|
| HTML5, CSS3, JavaScript, PHP y MySQL | USD 0,00 |
| XAMPP, VS Code, Git y GitHub | USD 0,00 |
| Licencias de programas para el alcance | USD 0,00 |
| **Total de insumos digitales** | **USD 0,00** |

Se consideran herramientas gratuitas y no se imputa un dominio ni un servicio de alojamiento. Si el equipo pagó alguno de estos insumos, debe agregarlo y recalcular el consolidado.

## 3. Costos operativos fijos

Se prorratea el costo mensual entre las 176 horas laborables del mes y luego por las 20 horas del proyecto:

```text
Costo operativo por hora = USD 35,03 / 176 h = USD 0,1990/h
Costo operativo del proyecto = USD 0,1990/h × 20 h = USD 3,98
```

**Costo operativo imputado: USD 3,98.**

## 4. Mano de obra

```text
Valor por hora = USD 500 / 176 h = USD 2,8409/h
Mano de obra = USD 2,8409/h × 20 h = USD 56,82
```

**Costo de mano de obra: USD 56,82.**

## 5. Inversión en equipo informático

Se aplica el divisor anual de 2.112 horas indicado por la metodología. La inversión de referencia es USD 570:

```text
Costo del equipo por hora = USD 570 / 2.112 h = USD 0,2699/h
Equipo imputado = USD 0,2699/h × 20 h = USD 5,40
```

La vida útil de referencia del equipo es de tres años. No se vuelve a multiplicar el divisor anual por tres, para conservar el método especificado (inversión ÷ 2.112 h).

## 6. Desgaste y Costo Total Consolidado (CTC)

| Componente | Cálculo | Costo |
|---|---|---:|
| Insumos digitales | Licencias y servicios imputables | USD 0,00 |
| Costos operativos | (35,03 ÷ 176) × 20 | USD 3,98 |
| Mano de obra | (500 ÷ 176) × 20 | USD 56,82 |
| Equipo informático | (570 ÷ 2.112) × 20 | USD 5,40 |
| **Subtotal directo** | 0,00 + 3,98 + 56,82 + 5,40 | **USD 66,20** |
| Desgaste y contingencia | 66,20 × 20 % | USD 13,24 |
| **CTC** | 66,20 + 13,24 | **USD 79,44** |

## 7. Banda de precios

Los porcentajes se aplican como margen sobre el CTC: `precio = CTC × (1 + margen)`.

| Margen | Operación | Precio sugerido | Diferencia sobre CTC |
|---:|---|---:|---:|
| 30 % | 79,44 × 1,30 | **USD 103,27** | USD 23,83 |
| 45 % | 79,44 × 1,45 | **USD 115,19** | USD 35,75 |
| 70 % | 79,44 × 1,70 | **USD 135,05** | USD 55,61 |

### Conciliación con el Kanban

**Horas valoradas e informadas por el equipo: 20 h. Total distribuido entre las tarjetas de `KANBAN.md`: 20 h.** Los cálculos se redondean a dos decimales en cada componente presentado.
