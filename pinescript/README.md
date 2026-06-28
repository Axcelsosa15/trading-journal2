# NQ EMA/VWAP — Backtest en TradingView (Pine Script v6)

Implementación del **Protocolo oficial v1.0** del Sistema de Trading NQ para hacer
backtesting en TradingView (Strategy Tester).

Archivo: [`NQ_EMA_VWAP_Strategy.pine`](./NQ_EMA_VWAP_Strategy.pine)

## Cómo cargarlo

1. Abre TradingView → gráfico de **NQ** (futuro Nasdaq) en tu temporalidad de
   estudio (p. ej. 1m, 5m o 15m).
2. Abre el **Pine Editor** (parte inferior).
3. Pega el contenido de `NQ_EMA_VWAP_Strategy.pine`.
4. **Add to chart**.
5. Abre la pestaña **Strategy Tester** para ver métricas (Net Profit, Win Rate,
   Profit Factor, Max Drawdown, lista de trades, etc.).

## Reglas implementadas (= protocolo v1.0)

| Fase | Regla | En el código |
|------|-------|--------------|
| Dirección | Precio > EMA200 (long) / < EMA200 (short) | `longTrend` / `shortTrend` |
| Estructura | EMA20 > EMA55 > EMA200 (inverso en short) | `longStructure` / `shortStructure` |
| VWAP | Precio sobre/bajo VWAP | `longVwap` / `shortVwap` |
| Volumen | Volumen actual > SMA20(Volumen) | `volOk` |
| Pullback | El precio toca EMA20 o EMA55 (cuerpo o mecha) | `touched` + `recentPullback` |
| Trigger | EMA3 cruza EMA10 | `ta.crossover/crossunder` |
| Entrada | Al cierre de la vela del cruce | `process_orders_on_close=true` |
| Stop | Long = mínimo últimas 5 velas / Short = máximo últimas 5 | `ta.lowest/highest(.., slLookback)` |
| Salidas | TP1 = 1R (50%), TP2 = 2R (50%) | `strategy.exit` TP1/TP2 |

## Notas de implementación (importantes)

- **Entrada al cierre del cruce:** la estrategia usa `process_orders_on_close=true`,
  por lo que la orden se ejecuta al cierre de la vela donde EMA3 cruza EMA10,
  tal como pide el protocolo.
- **Pullback con ventana:** el protocolo dice "el precio toca EMA20 o EMA55", pero
  el cruce EMA3/EMA10 normalmente ocurre 1–3 velas *después* del toque. Para no
  perder señales válidas, se admite que el toque haya ocurrido dentro de las
  últimas N velas (input **Ventana de pullback**, por defecto 5). Si quieres
  exigir el toque en la misma vela del cruce, pon la ventana en `1`.
- **Definición de "toque":** la EMA queda dentro del rango high–low de la vela
  (`low <= EMA <= high`). Cubre tanto cuerpo como mecha.
- **VWAP:** se usa `ta.vwap(hlc3)`, que se reinicia por sesión (comportamiento
  institucional estándar intradía).
- **Stop con riesgo 0:** si el mínimo/máximo de las últimas 5 velas coincide con
  el precio de entrada (riesgo = 0), la entrada se omite para evitar divisiones y
  trades sin sentido.
- **R fijo:** todo se mide en R. El stop define 1R; TP1 = 1R y TP2 = 2R.

## Parámetros configurables

- EMAs (3/10/20/55/200) y longitud de SMA de volumen.
- Activar/desactivar filtros VWAP y Volumen.
- Ventana de pullback y lookback del stop.
- TP1/TP2 en múltiplos de R y % a cerrar en TP1.
- Permitir solo Long / solo Short.
- Filtro de **sesión** horaria (p. ej. `0930-1600`) — útil para Open / Lunch /
  Power Hour.
- Filtro de **rango de fechas**.

## Recordatorio del protocolo

> **No optimizar ni cambiar nada durante los próximos 200 trades.**
> Primer análisis a 100 trades; análisis serio a 200 trades.

El objetivo del backtest es **medir la ventaja estadística**, no ajustar los
parámetros hasta que se vean bonitos. Deja los inputs en sus valores por defecto
para evaluar el protocolo tal cual está definido.
