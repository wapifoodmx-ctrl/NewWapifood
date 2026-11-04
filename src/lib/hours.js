/** Misma lectura que webmenu/[uuid].js del front legado.
 *  Sin horario, el local se trata como abierto.
 *  La hora es la del dispositivo, igual que allí.
 */
const DAYS = {
  Lun: 1, Mar: 2, Mie: 3, Jue: 4, Vie: 5, Sab: 6, Dom: 0,
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
};

export function isOpenNow(horarioString, now = new Date()) {
  if (!horarioString || !String(horarioString).trim()) return true;
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const re = /([A-Za-zÁ-ú-]+)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g;
  let match;
  let saw = false;
  while ((match = re.exec(String(horarioString))) !== null) {
    saw = true;
    const [, dias, h1, m1, h2, m2] = match;
    const valid = [];
    if (dias.includes("-")) {
      const [a, b] = dias.split("-");
      const start = DAYS[a];
      const end = DAYS[b];
      if (start == null || end == null) continue;
      if (start <= end) {
        for (let i = start; i <= end; i += 1) valid.push(i);
      } else {
        for (let i = start; i <= 6; i += 1) valid.push(i);
        for (let i = 0; i <= end; i += 1) valid.push(i);
      }
    } else if (DAYS[dias] != null) {
      valid.push(DAYS[dias]);
    }
    if (!valid.includes(currentDay)) continue;
    const open = Number(h1) * 60 + Number(m1);
    const close = Number(h2) * 60 + Number(m2);
    if (currentTime >= open && currentTime <= close) return true;
  }
  return saw ? false : true;
}
