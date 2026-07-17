/**
 * Lógica compartida para interpretar severidad/estado de alarmas
 * en la UI (colores, labels, orden de prioridad). La generación de
 * alarmas en sí vive en el backend (trigger/función en cada spoke).
 * TODO Sesión futura: implementar mapeo severidad -> color/label,
 * y utilidades de orden (crítica > atención > info).
 */
export const SEVERITY_ORDER = ['critica', 'atencion', 'info'];

export function compareSeverity(a, b) {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}
