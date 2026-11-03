// v134: before a pro accepts a job, show the price, Trothen's commission,
// how it is paid and what they will receive. Shown for jobs paid through
// Trothen and for cash jobs alike. Only the pro sees this; customers see
// what they pay (price plus Trothen's service fee), as on most marketplaces.
//
// Covers every place a pro accepts work:
//   - My Contracts: "Confirm Booking" and "Accept $X" on a customer's offer
//   - Job Matches: "Accept the job at $X"
//   - Suggesting a price: a live "you would receive" line under the amount
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const usd = (n) => '$' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (r) => `${Math.round((Number(r) || 0) * 1000) / 10}%`;
  const toks = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString()} ${t(Number(n) === 1 ? 'token' : 'tokens')}`;

  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Before you accept': 'Antes de aceptar', 'Job price': 'Precio del trabajo', 'Store goods (no commission)': 'Productos de tienda (sin comisión)',
      'Trothen commission': 'Comisión de Trothen', 'Store purchase fee': 'Cargo por compra en tienda', 'You receive': 'Recibes',
      'Paid through Trothen.': 'Pagado a través de Trothen.',
      'The customer pays Trothen, and it is held until they confirm the job is done. The commission is taken when you request your payout.': 'El cliente le paga a Trothen y el dinero se retiene hasta que confirme que el trabajo está hecho. La comisión se descuenta cuando solicitas tu retiro.',
      'Your tokens pay this first': 'Tus tokens pagan esto primero', 'then the rest is taken from your payout.': 'y el resto se descuenta de tu retiro.',
      'so nothing is taken from your payout.': 'así que no se descuenta nada de tu retiro.',
      'Cash job.': 'Trabajo en efectivo.', 'The customer pays you directly in cash after the work.': 'El cliente te paga directamente en efectivo después del trabajo.',
      'The commission is paid with tokens as soon as you accept.': 'La comisión se paga con tokens en cuanto aceptas.',
      'Your tokens': 'Tus tokens', 'after accepting': 'después de aceptar',
      'You do not have enough tokens for this cash job.': 'No tienes suficientes tokens para este trabajo en efectivo.',
      'You owe commission from an earlier cash job. Buy tokens first: what you owe is taken first.': 'Debes comisión de un trabajo en efectivo anterior. Compra tokens primero: lo que debes se descuenta primero.',
      'Buy Tokens': 'Comprar tokens', 'Your free-commission credit covers this job: no commission.': 'Tu crédito sin comisión cubre este trabajo: sin comisión.',
      'You have a free-commission credit. It is used on your next payout.': 'Tienes un crédito sin comisión. Se usa en tu próximo retiro.',
      'Driver Pass: no commission on this ride.': 'Pase de conductor: sin comisión en este viaje.',
      'Your rate': 'Tu tasa', 'Ride rate': 'Tarifa de viaje', 'Organization rate': 'Tasa de la organización', 'Custom rate': 'Tasa especial',
      'Accept and Confirm': 'Aceptar y confirmar', 'Could not work out the commission. You can still accept.': 'No se pudo calcular la comisión. Puedes aceptar igualmente.',
      'You would receive': 'Recibirías', 'after': 'después de', 'commission': 'comisión', 'Accept the job at': 'Aceptar el trabajo por',
      'If you\'re the first to accept, the job is yours.': 'Si eres el primero en aceptar, el trabajo es tuyo.',
      'Customers do not see your commission.': 'Los clientes no ven tu comisión.',
      'in cash': 'en efectivo', 'Cash job': 'Trabajo en efectivo', 'you receive': 'recibes', 'from the customer': 'del cliente', 'You have': 'Tienes', 'buy': 'compra', 'more to accept': 'más para aceptar', 'Your tokens pay': 'Tus tokens pagan', 'of it first': 'de esto primero', 'At': 'A', 'plus': 'más', 'store goods (no commission)': 'en productos de tienda (sin comisión)', 'less a': 'menos un', 'store purchase fee': 'cargo por compra en tienda', 'paid with tokens when you accept': 'pagada con tokens al aceptar',
    });
  } catch (err) {}

  function rateLabel(q) {
    if (q.passFree) return t('Driver Pass: no commission on this ride.');
    if (q.ride) return `${t('Ride rate')} ${pct(q.rate)}`;
    if (q.rateSource === 'organization') return `${t('Organization rate')}${q.organizationName ? ` (${e(q.organizationName)})` : ''} ${pct(q.rate)}`;
    if (q.rateSource === 'override') return `${t('Custom rate')} ${pct(q.rate)}`;
    return `${t('Your rate')}: ${e(q.planLabel)} ${pct(q.rate)}`;
  }
  function row(label, value, opts) {
    const o = opts || {};
    return `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;${o.total ? 'border-top:1px solid var(--border);margin-top:4px;padding-top:10px;font-weight:700;color:var(--navy);font-size:16px;' : ''}">
      <span>${label}${o.sub ? `<div style="font-size:12.5px;color:var(--slate);font-weight:400;margin-top:1px;">${o.sub}</div>` : ''}</span><span style="white-space:nowrap;${o.minus ? 'color:#B42318;' : ''}">${value}</span></div>`;
  }
  // The breakdown shown before accepting. Returns { html, blocked }.
  function quoteHTML(q, heading) {
    const lines = [];
    lines.push(row(e(t('Job price')), usd(q.price)));
    if (q.goods > 0) lines.push(row(e(t('Store goods (no commission)')), usd(q.goods)));
    let blocked = false, note = '';
    if (q.payMethod === 'cash' && !q.ride) {
      lines.push(row(`${e(t('Trothen commission'))} (${pct(q.rate)})`, q.freeCreditUsed ? usd(0) : `${e(toks(q.commission))}`, { sub: q.freeCreditUsed ? e(t('Your free-commission credit covers this job: no commission.')) : `${rateLabel(q)}. ${e(t('The commission is paid with tokens as soon as you accept.'))}` }));
      if (q.storeFee > 0) lines.push(row(e(t('Store purchase fee')), `−${usd(q.storeFee)}`, { minus: true }));
      lines.push(row(e(t('You receive')), usd(q.youReceive), { total: true, sub: e(t('The customer pays you directly in cash after the work.')) }));
      if (!q.freeCreditUsed && q.commission > 0) {
        const after = Math.round(((q.tokens.balance || 0) - q.commission) * 100) / 100;
        note = `${e(t('Your tokens'))}: ${e(toks(q.tokens.balance))}${q.tokensEnough ? ` → ${e(toks(after))} ${e(t('after accepting'))}` : ''}`;
      }
      if (!q.tokensEnough) {
        blocked = true;
        note = `<div style="color:#B42318;font-weight:600;">${e(t(q.tokens.debt > 0 ? 'You owe commission from an earlier cash job. Buy tokens first: what you owe is taken first.' : 'You do not have enough tokens for this cash job.'))}</div>${note ? `<div>${note}</div>` : ''}`;
      }
      heading = heading || t('Cash job.');
    } else {
      const how = q.passFree ? '' : q.tokensWouldCover > 0
        ? (q.tokensWouldCover >= q.commission ? `${e(t('Your tokens pay this first'))} (${e(toks(q.tokensWouldCover))}), ${e(t('so nothing is taken from your payout.'))}` : `${e(t('Your tokens pay this first'))} (${e(toks(q.tokensWouldCover))}), ${e(t('then the rest is taken from your payout.'))}`)
        : '';
      lines.push(row(`${e(t('Trothen commission'))} (${pct(q.rate)})`, `−${usd(q.commission)}`, { minus: q.commission > 0, sub: `${rateLabel(q)}${how ? `. ${how}` : ''}` }));
      if (q.tokensWouldCover > 0) lines.push(row(e(t('Your tokens pay this first')), `+${usd(q.tokensWouldCover)}`));
      if (q.storeFee > 0) lines.push(row(e(t('Store purchase fee')), `−${usd(q.storeFee)}`, { minus: true }));
      lines.push(row(e(t('You receive')), usd(q.youReceive), { total: true }));
      note = e(t('The customer pays Trothen, and it is held until they confirm the job is done. The commission is taken when you request your payout.'));
      if (q.freeCredits > 0) note += ` ${e(t('You have a free-commission credit. It is used on your next payout.'))}`;
      heading = heading || t('Paid through Trothen.');
    }
    const html = `<div style="text-align:left;">
      <div style="font-weight:700;color:var(--navy);font-size:16px;margin-bottom:6px;">${e(heading)}</div>
      <div style="font-size:14px;">${lines.join('')}</div>
      ${note ? `<div style="font-size:12.5px;color:var(--slate);margin-top:8px;line-height:1.5;">${note}</div>` : ''}
      <div style="font-size:12px;color:var(--slate);margin-top:6px;">${e(t('Customers do not see your commission.'))}</div>
    </div>`;
    return { html, blocked };
  }
  window.commissionQuoteHTML = quoteHTML;

  // The app's confirm dialog takes plain text; this fills it with the breakdown.
  function confirmWithHTML(html, opts) {
    const p = confirmDialog('', opts || {});
    const m = document.getElementById('confirm-dialog-message');
    if (m) m.innerHTML = html;
    return p;
  }
  async function getQuote(params) {
    const q = new URLSearchParams(params);
    return (await apiFetch('GET', `/payouts/commission-quote?${q.toString()}`)).quote;
  }
  // Shows the breakdown. Resolves true to go ahead, false to stop.
  async function confirmAccept(params, heading, confirmLabel) {
    let q;
    try { q = await getQuote(params); }
    catch (err) { return confirmDialog(t('Could not work out the commission. You can still accept.'), { confirmLabel: confirmLabel || t('Accept and Confirm') }); }
    const { html, blocked } = quoteHTML(q, heading);
    if (blocked) {
      const go = await confirmWithHTML(html, { confirmLabel: t('Buy Tokens') });
      if (go && typeof selectProviderSection === 'function') selectProviderSection('tokens');
      return false;
    }
    return confirmWithHTML(html, { confirmLabel: confirmLabel || t('Accept and Confirm') });
  }
  window.confirmAcceptWithCommission = confirmAccept;

  // My Contracts: Confirm Booking, and Accept $X on a customer's offer.
  if (typeof respondToOffer === 'function') {
    const base = respondToOffer;
    respondToOffer = async function (contractId, decision) {
      if (decision === 'accept' && (typeof BACKEND_AVAILABLE === 'undefined' || BACKEND_AVAILABLE)) {
        const ok = await confirmAccept({ contractId }, null);
        if (!ok) return;
      }
      return base.apply(this, arguments);
    };
  }

  // Job Matches: "Accept the job at $X" (the customer's posted budget).
  if (typeof acceptPostedBudget === 'function') {
    acceptPostedBudget = async function (matchId, amount) {
      const m = (providerData.matches || []).find(x => x.id === matchId) || {};
      const ok = await confirmAccept({ matchId, amount }, `${t('Accept the job at')} ${usd(amount)}: ${m.service || ''}`.trim(), t('Accept and Confirm'));
      if (!ok) return;
      try {
        const r = await apiFetch('POST', `/matches/${encodeURIComponent(matchId)}/accept-budget`, {});
        const st = r && r.contract && r.contract.status;
        showToast(st === 'active' ? t('The job is yours. It\'s in My Contracts.') : t('The job is yours. The customer is asked to pay now; you\'ll be told the moment they do.'));
        await loadProviderData(); selectProviderSection('contracts');
      } catch (x) { showToast(x.message || t('Could not accept this job')); await loadProviderData(); selectProviderSection('matches'); }
    };
  }

  // Under every booking or job the pro has not accepted yet, a line with the
  // price on the table now, the commission and what they receive. It is
  // worked out again each time the page is drawn, so it follows every new
  // price either side suggests, until the pro accepts.
  const cache = new Map();
  async function cachedQuote(params) {
    const key = JSON.stringify(params);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 20000) return hit.q;
    const q = await getQuote(params);
    cache.set(key, { q, at: Date.now() });
    return q;
  }
  function lineText(q) {
    if (q.payMethod === 'cash' && !q.ride) {
      if (q.freeCreditUsed) return `${e(t('Cash job'))}: ${e(t('you receive'))} <strong>${usd(q.youReceive)}</strong> ${e(t('from the customer'))}. ${e(t('Your free-commission credit covers this job: no commission.'))}`;
      const short = Math.round(((q.tokensNeeded || 0) - (q.tokens.balance || 0)) * 100) / 100;
      return `${e(t('Cash job'))}: ${e(t('you receive'))} <strong>${usd(q.youReceive)}</strong> ${e(t('from the customer'))}. ${e(t('Trothen commission'))} ${pct(q.rate)}: <strong>${e(toks(q.tokensNeeded))}</strong>, ${e(t('paid with tokens when you accept'))}. `
        + (q.tokens.debt > 0 ? `<span style="color:#B42318;">${e(t('You owe commission from an earlier cash job. Buy tokens first: what you owe is taken first.'))}</span>`
          : q.tokensEnough ? `${e(t('You have'))} ${e(toks(q.tokens.balance))}.`
          : `<span style="color:#B42318;">${e(t('You have'))} ${e(toks(q.tokens.balance))}: ${e(t('buy'))} ${e(toks(short))} ${e(t('more to accept'))}.</span> <a onclick="selectProviderSection('tokens')" style="color:var(--teal);cursor:pointer;font-weight:600;">${e(t('Buy Tokens'))} →</a>`);
    }
    const tok = q.tokensWouldCover > 0 ? ` ${e(t('Your tokens pay'))} ${e(toks(q.tokensWouldCover))} ${e(t('of it first'))}.` : '';
    return `${e(t('At'))} ${usd(q.price)}${q.goods > 0 ? ` ${e(t('plus'))} ${usd(q.goods)} ${e(t('store goods (no commission)'))}` : ''}${q.storeFee > 0 ? `, ${e(t('less a'))} ${usd(q.storeFee)} ${e(t('store purchase fee'))}` : ''}: ${e(t('you receive'))} <strong>${usd(q.youReceive)}</strong> ${e(t('after'))} ${pct(q.rate)} ${e(t('commission'))} (${usd(q.commission)}).${tok}`;
  }
  function paramsFor(el) {
    const on = el.getAttribute('onclick') || '';
    let m = /respondToOffer\(\s*['"]([^'"]+)['"]/.exec(on);
    if (m) {
      // The price on the table now, so the line follows every new price.
      const c = (typeof RAW_CONTRACTS === 'object' && RAW_CONTRACTS[m[1]]) || null;
      const price = c ? Number(c.laborAmount != null ? c.laborAmount : Math.max(0, (c.amount || 0) - (c.storeGoodsTotal || 0))) : null;
      return price > 0 ? { contractId: m[1], amount: price } : { contractId: m[1] };
    }
    m = /acceptPostedBudget\(\s*['"]([^'"]+)['"]\s*,\s*([\d.]+)/.exec(on);
    if (m) return { matchId: m[1], amount: Number(m[2]) };
    m = /changeMatchPrice\(\s*['"]([^'"]+)['"]/.exec(on);
    if (m) { const mm = (providerData.matches || []).find(x => x.id === m[1]); if (mm && mm.price) return { matchId: m[1], amount: Number(mm.price) }; }
    return null;
  }
  function fillLines(root) {
    if (typeof AUTH === 'undefined' || !AUTH.user || AUTH.user.role !== 'provider') return;
    const main = document.getElementById('provider-main'); if (!main || (root && !main.contains(root) && root !== main && !(root.contains && root.contains(main)))) return;
    const seen = new Set();
    main.querySelectorAll('[onclick*="respondToOffer("], [onclick*="acceptPostedBudget("], [onclick*="changeMatchPrice("]').forEach(btn => {
      const params = paramsFor(btn); if (!params) return;
      const cell = btn.closest('td') || btn.parentElement; if (!cell) return;
      const key = JSON.stringify(params);
      if (seen.has(cell)) return; seen.add(cell);
      let line = cell.querySelector(':scope > .quote-line');
      if (line && line.dataset.key === key) return;
      if (!line) { line = document.createElement('div'); line.className = 'quote-line'; line.style.cssText = 'font-size:12.5px;color:var(--text);background:var(--offwhite);border-radius:8px;padding:7px 9px;margin-top:8px;line-height:1.5;max-width:420px;white-space:normal;'; cell.appendChild(line); }
      line.dataset.key = key; line.textContent = '…';
      cachedQuote(params).then(q => { if (line.dataset.key === key) line.innerHTML = lineText(q); }).catch(() => line.remove());
    });
  }
  window.fillCommissionLines = fillLines;
  let fillTimer = null;
  new MutationObserver(() => { clearTimeout(fillTimer); fillTimer = setTimeout(() => fillLines(), 120); }).observe(document.body, { childList: true, subtree: true });

  // While a pro types a price (suggesting a price on a booking, or sending or
  // changing their price on a job match), show what they would receive
  // under the amount box.
  let ctx = null;
  const remember = (name, make) => {
    if (typeof window[name] !== 'function') return;
    const f = window[name];
    window[name] = function () { const c = make.apply(null, arguments); if (c) ctx = c; return f.apply(this, arguments); };
  };
  remember('suggestPrice', (contractId, viewer) => (viewer === 'provider' ? { contractId } : null));
  remember('respondToMatch', (id, decision) => (decision === 'accept' ? { matchId: id } : null));
  remember('changeMatchPrice', (id) => ({ matchId: id }));
  if (typeof respondToMatch === 'function' && window.respondToMatch !== respondToMatch) respondToMatch = window.respondToMatch;
  const PRICE_BOXES = { 'ps-amount': 1, 'mq-price': 1, 'mp-price': 1 };
  let timer = null;
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el || !PRICE_BOXES[el.id] || !ctx) return;
    if (typeof AUTH === 'undefined' || !AUTH.user || AUTH.user.role !== 'provider') return;
    let out = el.parentElement.querySelector('.you-receive-line');
    if (!out) { out = document.createElement('div'); out.className = 'you-receive-line'; out.style.cssText = 'font-size:13px;color:var(--navy);margin-top:6px;'; el.insertAdjacentElement('afterend', out); }
    const amount = Number(el.value);
    clearTimeout(timer);
    if (!(amount > 0)) { out.textContent = ''; return; }
    const here = ctx;
    timer = setTimeout(async () => {
      try {
        const q = await getQuote({ ...here, amount });
        if (Number(el.value) !== amount) return; // they kept typing
        out.innerHTML = q.payMethod === 'cash' && !q.ride
          ? `${e(t('You would receive'))} <strong>${usd(q.youReceive)}</strong> ${e(t('in cash'))}. ${e(t('Trothen commission'))}: ${e(toks(q.commission))} (${pct(q.rate)}), ${e(t('paid with tokens when you accept'))}.`
          : `${e(t('You would receive'))} <strong>${usd(q.youReceive)}</strong> ${e(t('after'))} ${pct(q.rate)} ${e(t('commission'))} (${usd(q.commission)}).`;
      } catch (err) { out.textContent = ''; }
    }, 300);
  });
})();
