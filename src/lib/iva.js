/** Parte de IVA ya incluida en el precio. No se suma al total. */
export function includedIva(total, rate = 0.16) {
  const amount = Number(total) || 0;
  const tax = Number(rate) || 0;
  if (amount <= 0 || tax <= 0) return 0;
  return amount * tax / (1 + tax);
}
