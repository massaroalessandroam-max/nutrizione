// Il server (Render) gira in UTC; i pazienti sono in Italia, quindi data e
// ora vanno derivate nel fuso Europe/Rome (non UTC), altrimenti sia il
// "giorno" che l'orario registrato sballano di 1-2 ore a seconda dell'ora
// legale.
const romeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

export function romeParts(d = new Date()) {
  const p = Object.fromEntries(romeFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function todayStr(): string {
  return romeParts().date;
}
