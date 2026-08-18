/**
 * Stylesheet for the usage/cost surfaces. Accents use the theme brand token
 * (`--dsw-alias-brand-primary`) so the plugin follows the active theme (blue in
 * DSH default, gold under the black-gold theme). Neutral borders/tracks/axes use
 * scoped variables with light defaults and dark overrides.
 * @module @frostgao/dsh-usage-cost/client/style
 */

export const CSS = `
:root {
  --dsh-usage-border: #d9dde3;
  --dsh-usage-border-soft: #e9ebee;
  --dsh-usage-track: #e9ebee;
  --dsh-usage-grid: #e9ebee;
  --dsh-usage-axis: #9aa1ab;
  --dsh-usage-text: #1f2328;
  --dsh-usage-muted: #6b7280;
  --dsh-usage-surface: #ffffff;
}
body[data-ds-dark-theme] {
  --dsh-usage-border: #333333;
  --dsh-usage-border-soft: #222222;
  --dsh-usage-track: #222222;
  --dsh-usage-grid: #333333;
  --dsh-usage-axis: #6b7280;
  --dsh-usage-text: #e6e8eb;
  --dsh-usage-muted: #9aa1ab;
  --dsh-usage-surface: #1b1b1b;
}

/* --- session header badge --- */
.dsh-header-cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-brand-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: filter 120ms ease, background 120ms ease, color 120ms ease;
}
.dsh-header-cost:hover {
  filter: brightness(1.12);
}

/* --- per-message chip --- */
.dsh-cost-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 999px;
  background: transparent;
  color: var(--dsh-usage-muted);
  font-size: 11px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* --- settings usage section --- */
.dsh-usage-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--dsh-usage-text);
  font-size: 13px;
}

.dsh-usage-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dsh-usage-btn {
  padding: 5px 12px;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 8px;
  background: transparent;
  color: var(--dsh-usage-muted);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: filter 120ms ease, border-color 120ms ease;
}
.dsh-usage-btn:hover {
  filter: brightness(1.08);
}
.dsh-usage-btn-active {
  background: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-inverted);
}

.dsh-usage-model {
  max-width: 150px;
  padding: 5px 8px;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 8px;
  background: var(--dsh-usage-surface);
  color: var(--dsh-usage-text);
  font-size: 12px;
}

.dsh-usage-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 8px;
  background: transparent;
  color: var(--dsh-usage-muted);
  font-size: 12px;
  cursor: pointer;
}
.dsh-usage-icon-btn:hover {
  filter: brightness(1.08);
}

.dsh-usage-refresh {
  margin-left: auto;
}
.dsh-usage-refresh svg {
  width: 13px;
  height: 13px;
  display: block;
}
.dsh-usage-refresh.spinning svg {
  animation: dsh-usage-spin 900ms linear infinite;
}
@keyframes dsh-usage-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.dsh-usage-custom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed var(--dsh-usage-border);
  border-radius: 8px;
}
.dsh-usage-custom label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsh-usage-muted);
  font-size: 12px;
}
.dsh-usage-custom input {
  padding: 4px 6px;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 6px;
  background: var(--dsh-usage-surface);
  color: var(--dsh-usage-text);
  font-size: 12px;
}

/* --- totals --- */
.dsh-usage-total-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px;
}
.dsh-usage-total-cost {
  font-size: 30px;
  font-weight: 700;
  color: var(--dsw-alias-brand-primary);
  font-variant-numeric: tabular-nums;
}
.dsh-usage-total-tokens {
  color: var(--dsh-usage-muted);
  font-size: 13px;
}

/* --- three bucket blocks + cache-hit bar --- */
.dsh-usage-blocks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.dsh-usage-block {
  padding: 10px 12px;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 10px;
  background: var(--dsh-usage-surface);
}
.dsh-usage-block-label {
  color: var(--dsh-usage-muted);
  font-size: 12px;
  margin-bottom: 4px;
}
.dsh-usage-block-value {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dsh-usage-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--dsh-usage-muted);
}
.dsh-usage-progress {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--dsh-usage-track);
  overflow: hidden;
}
.dsh-usage-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary);
  transition: width 200ms ease;
}

/* --- chart --- */
.dsh-chart-wrap {
  position: relative;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 10px;
  background: var(--dsh-usage-surface);
  padding: 10px 12px 6px;
}
.dsh-chart-info {
  min-height: 20px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--dsh-usage-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-chart-info b {
  color: var(--dsh-usage-text);
  font-weight: 600;
  margin-right: 10px;
}
.dsh-chart-info .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: 0 4px 0 8px;
  vertical-align: baseline;
}
.dsh-chart {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
}
.dsh-chart .grid-line {
  stroke: var(--dsh-usage-grid);
  stroke-width: 1;
}
.dsh-chart .axis-label {
  fill: var(--dsh-usage-axis);
  font-size: 10px;
}
.dsh-chart .x-label {
  fill: var(--dsh-usage-axis);
  font-size: 10px;
  text-anchor: middle;
}
.dsh-chart .hover-line {
  stroke: var(--dsh-usage-muted);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.dsh-chart .legend-line {
  stroke-width: 3;
  stroke-linecap: round;
}
.dsh-chart .legend-text {
  fill: var(--dsh-usage-muted);
  font-size: 11px;
}
.dsh-usage-empty {
  color: var(--dsh-usage-muted);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}

/* --- per-session list --- */
.dsh-usage-sessions {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsh-usage-border);
  border-radius: 10px;
  overflow: hidden;
}
.dsh-usage-session {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--dsh-usage-border-soft);
  background: var(--dsh-usage-surface);
}
.dsh-usage-session:last-child {
  border-bottom: none;
}
.dsh-usage-session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsh-usage-text);
}
.dsh-usage-session-tokens {
  color: var(--dsh-usage-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dsh-usage-session-cost {
  color: var(--dsw-alias-brand-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* --- loading --- */
.dsh-usage-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--dsh-usage-muted);
  font-size: 13px;
}
.dsh-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--dsh-usage-track);
  border-top-color: var(--dsw-alias-brand-primary);
  border-radius: 50%;
  animation: dsh-usage-spin 900ms linear infinite;
}
`
