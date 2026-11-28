(() => {
  const home = document.getElementById('inicio');
  if (!home || document.getElementById('climaExterior')) return;
  const panel = document.createElement('section');
  panel.id = 'climaExterior';
  panel.className = 'card';
  panel.setAttribute('aria-labelledby', 'climaTitulo');
  panel.innerHTML = `<style>
    #climaExterior{display:block;margin:1rem 0}
    #climaExterior h2{font-size:1.22rem;margin:0;color:var(--brand)}
    #climaExterior p{margin:.4rem 0}
    .clima-semana{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:.45rem;margin:.75rem 0}
    .clima-dia{border:1px solid var(--line);border-radius:10px;padding:.6rem;min-width:0}
    .clima-dia summary{cursor:pointer;line-height:1.5}
    .clima-dia small{display:block;color:var(--muted)}
    .clima-estado{display:block;font-weight:650;font-size:.9rem;margin-top:.25rem}
    .clima-dia ul{list-style:none;padding:0;margin:.5rem 0;font-size:.9rem}
    .clima-dia li{margin:.5rem 0}
    @media(max-width:600px){.clima-semana{grid-template-columns:1fr}.clima-dia summary .clima-estado{display:inline;margin-left:.7rem}}
  </style><h2 id="climaTitulo">Clima para citas en exterior</h2>
  <p>Batalla de Casa Mata 587 · Morelia, Michoacán · C.P. 58260</p>
  <small>Pronóstico de la zona en hora de Morelia. Abre un día para ver los horarios.</small>
  <div class="clima-semana"></div><p role="status"></p>
  <small>Confirma que la superficie esté seca en el domicilio de la cita. Datos de <a href="https://api.met.no/" target="_blank" rel="noopener">MET Norway</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</small>`;
  // Inicio rebuilds its cards when synced data or the active page changes.
  function placePanel() {
    if (panel.parentElement === home) return;
    const counters = home.querySelector('.grid.cards');
    if (counters) counters.after(panel);
    else home.prepend(panel);
  }
  placePanel();
  new MutationObserver(placePanel).observe(home, {childList:true});
  const grid = panel.querySelector('.clima-semana');
  const status = panel.querySelector('[role=status]');
  const hour = 3600000;
  const zone = 'America/Mexico_City';
  const dateKey = new Intl.DateTimeFormat('sv-SE', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
  const dateLabel = new Intl.DateTimeFormat('es-MX', {timeZone:zone,weekday:'short',day:'numeric',month:'short'});
  const stamp = new Intl.DateTimeFormat('es-MX', {timeZone:zone,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const key = 'simoun_clima_casamata_v1';
  const url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=19.6909&lon=-101.1708';
  const labels = {rain:'🌧️ Lluvia prevista',wet:'💧 Posible superficie mojada',dry:'🌤️ Sin lluvia prevista',unknown:'❔ Datos parciales'};
  let cached, busy = false;
  try { cached = JSON.parse(localStorage.getItem(key)); } catch {}
  function periods(series) {
    const slots = new Map();
    for (const row of series) {
      const start = Date.parse(row.time);
      const duration = row.data.next_1_hours ? 1 : 6;
      const period = row.data['next_' + duration + '_hours'];
      const mm = period?.details?.precipitation_amount;
      if (!Number.isFinite(mm)) continue;
      const rainy = mm > 0 || /rain|sleet|snow|thunder/.test(period.summary?.symbol_code || '');
      for (let i = 0; i < duration; i++) {
        const time = start + i * hour;
        if (duration === 1 || !slots.has(time)) slots.set(time, rainy);
      }
    }
    return slots;
  }
  function classify(slots, start, end) {
    let incomplete = false, recentRain = false;
    for (let t = start - 6 * hour; t < end; t += hour) {
      if (!slots.has(t)) incomplete = true;
      if (slots.get(t)) {
        if (t >= start) return 'rain';
        recentRain = true;
      }
    }
    return recentRain ? 'wet' : incomplete ? 'unknown' : 'dry';
  }
  function render(now) {
    const slots = periods(cached.series);
    const today = dateKey.format(now);
    // Morelia observes UTC−06:00 year-round.
    const midnight = Date.parse(today + 'T00:00:00-06:00');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 7; i++) {
      const day = midnight + i * 24 * hour;
      const weekday = new Date(day).getUTCDay();
      const temps = cached.series.filter(r => dateKey.format(Date.parse(r.time)) === dateKey.format(day)).map(r => r.data.instant.details.air_temperature).filter(Number.isFinite);
      const shifts = weekday === 6 ? [[9,14]] : weekday === 0 ? [[9,18]] : [[9,14],[15,18]];
      const rows = [];
      for (const [a,b] of shifts) {
        for (let h = a; h < b; h++) {
          const t = day + h * hour;
          if (t + hour <= now) continue;
          const state = classify(slots,t,t+hour);
          const last = rows.at(-1);
          if (last && last.end === h && last.state === state) last.end++;
          else rows.push({start:h,end:h+1,state});
        }
      }
      const details = document.createElement('details');
      details.className = 'clima-dia';
      const summary = document.createElement('summary');
      const title = i === 0 ? 'Hoy' : dateLabel.format(day);
      summary.append(title);
      const badge = document.createElement('span');
      badge.className = 'clima-estado';
      const types = new Set(rows.map(r => r.state));
      badge.textContent = types.size > 1 ? 'Horarios variables' : rows.length ? labels[rows[0].state] : shifts.length ? 'Jornada terminada' : 'Sin turno habitual';
      summary.append(badge);
      if (temps.length) {
        const range = document.createElement('small');
        range.textContent = Math.round(Math.min(...temps)) + '–' + Math.round(Math.max(...temps)) + ' °C previstas';
        summary.append(range);
      }
      details.append(summary);
      const list = document.createElement('ul');
      if (weekday === 0) list.innerHTML = '<li>Domingo · fuera de jornada habitual</li>';
      for (const row of rows) {
        const li = document.createElement('li');
        li.textContent = row.start + ':00–' + row.end + ':00 · ' + labels[row.state];
        list.append(li);
      }
      if (!rows.length) {
        const li = document.createElement('li');
        const dayState = classify(slots,day+9*hour,day+18*hour);
        li.textContent = 'Pronóstico de 9:00 a 18:00 · ' + labels[dayState];
        list.append(li);
      }
      details.append(list);
      fragment.append(details);
    }
    grid.replaceChildren(fragment);
  }
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      if (!cached || Date.now()-cached.checked >= hour) {
        status.textContent = 'Consultando el pronóstico…';
        const res = await fetch(url, {signal:AbortSignal.timeout(12000),referrerPolicy:'origin'});
        if (!res.ok) throw Error();
        const data = (await res.json()).properties;
        if (!data?.timeseries?.length || !Number.isFinite(Date.parse(data.meta.updated_at))) throw Error();
        const first = Date.parse(data.timeseries[0].time);
        const previous = (cached?.series || []).filter(r => Date.parse(r.time) < first && Date.parse(r.time) >= first-12*hour);
        cached = {checked:Date.now(), issued:data.meta.updated_at, series:previous.concat(data.timeseries)};
        try {localStorage.setItem(key, JSON.stringify(cached));} catch {}
      }
      if (Date.now()-Date.parse(cached.issued)>24*hour) throw Error();
      render(Date.now());
      status.textContent = 'Pronóstico actualizado el ' + stamp.format(Date.parse(cached.issued)) + '.';
    } catch {
      if (cached?.series?.length && Date.now()-Date.parse(cached.issued)<24*hour) {
        render(Date.now());
        status.textContent = 'Sin actualización. Mostrando el pronóstico guardado del ' + stamp.format(Date.parse(cached.issued)) + '.';
      } else {
        grid.replaceChildren();
        status.textContent = 'Pronóstico no disponible. Revisa el clima antes de confirmar la cita.';
      }
    } finally { busy = false; }
  }
  refresh();
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('online',refresh);
  setInterval(refresh,15*60*1000);
})();
