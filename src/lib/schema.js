/** La migración nueva puede no estar aplicada. Esas consultas no deben tumbar la pantalla. */
export function isMissingRelation(error) {
  const msg = `${error?.message || ""} ${error?.code || ""} ${error?.details || ""}`.toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("42p01") ||
    msg.includes("pgrst205") ||
    msg.includes("could not find the table")
  );
}
