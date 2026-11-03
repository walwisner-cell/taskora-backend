// v132: how commission is paid, shown plainly.
//
// Pros (Earnings & Payouts):
//   - "How Your Commission Is Paid": their real rate, what the next payout
//     will take, how it is taken, and what they have paid so far.
//   - A commission statement, job by job: awaiting completion, due at the
//     next payout, paid from a payout, or paid with tokens on a cash job.
//   - The "Available for Payout" card uses the server's own calculation
//     (the one the payout itself uses), not an estimate.
//   - Each payout in Payout History opens to a statement: earned, commission
//     and how it was paid, fees, tips, and what was paid out.
// Admins (Payments):
//   - "Commission Received": every commission and how it was paid.
//   - Platform Transactions shows the real commission once it is charged.
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const usd = (n) => '$' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (r) => (r == null ? '' : `${Math.round(r * 1000) / 10}%`);
  const toks = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString()} ${t(Number(n) === 1 ? 'token' : 'tokens')}`;
  const PLAN = { starter: 'Starter', pro: 'Pro', superpro: 'Super Pro' };

  const HOW = {
    payout: 'Taken from payout',
    'payout-tokens': 'Tokens, then payout',
    'tokens-at-payout': 'Paid with tokens',
    'cash-tokens': 'Paid with tokens (cash job)',
    'free-credit': 'Free-commission credit',
  };
  const STATUS = {
    pending: ['badge-warn', 'Awaiting Completion'],
    due: ['badge-pending', 'Due at Next Payout'],
    paid: ['badge-success', 'Paid'],
    returned: ['badge-neutral', 'Returned'],
    free: ['badge-success', 'Not Charged'],
  };
  const badge = (s) => { const b = STATUS[s] || ['badge-neutral', s]; return `<span class="badge ${b[0]}">${e(t(b[1]))}</span>`; };
  const commissionCell = (r) => (r.how === 'cash-tokens' ? e(toks(r.tokens != null ? r.tokens : r.commission)) : usd(r.commission));

  // ── Spanish ──────────────────────────────────────────────────────────
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'How Your Commission Is Paid': 'Cómo se paga tu comisión', 'Your commission rate': 'Tu tasa de comisión', 'plan': 'plan',
      'Organization rate': 'Tasa de la organización', 'Custom rate approved by Trothen': 'Tasa especial aprobada por Trothen',
      'Rides': 'Viajes', 'Tips and store goods: no commission.': 'Propinas y productos de tienda: sin comisión.',
      'Due at your next payout': 'A pagar en tu próximo retiro', 'Commission paid so far': 'Comisión pagada hasta ahora',
      'from payouts': 'de retiros', 'with tokens at payout': 'con tokens al retirar', 'on cash jobs': 'en trabajos en efectivo',
      'Taken from the payout when you request it.': 'Se descuenta del retiro cuando lo solicitas.',
      'Your free-commission credit applies: no commission will be charged.': 'Se aplica tu crédito sin comisión: no se cobrará comisión.',
      'Jobs paid through Trothen': 'Trabajos pagados a través de Trothen',
      'The customer\'s payment is held until they mark the job complete. When you request a payout, Trothen\'s commission is taken out first and you receive the rest. You never pay it separately.': 'El pago del cliente se retiene hasta que marca el trabajo como completado. Cuando solicitas un retiro, se descuenta la comisión y recibes el resto. Nunca la pagas por separado.',
      'The customer\'s payment is held until they mark the job complete. When you request a payout, the commission is paid from your tokens first (see 3), and anything they do not cover is taken from the payout. You never pay it separately.': 'El pago del cliente se retiene hasta que marca el trabajo como completado. Cuando solicitas un retiro, la comisión se paga primero con tus tokens (ver 3) y lo que no cubran se descuenta del retiro. Nunca la pagas por separado.',
      'Cash jobs': 'Trabajos en efectivo',
      'The customer pays you directly, so the commission is paid with tokens when you accept the job. If the price changes or the job does not go ahead, the tokens are corrected or given back.': 'El cliente te paga directamente, así que la comisión se paga con tokens cuando aceptas el trabajo. Si el precio cambia o el trabajo no se realiza, los tokens se ajustan o se devuelven.',
      'Paying with tokens': 'Pagar con tokens', 'Tokens': 'Tokens',
      'On: tokens pay the commission at payout first, so you keep more of the payout.': 'Activado: los tokens pagan primero la comisión al retirar, así que recibes más del retiro.',
      'Off: the commission is taken out of the job money before the rest is paid to you. Tokens are for the commission on cash jobs.': 'Desactivado: la comisión se descuenta del dinero del trabajo antes de pagarte el resto. Los tokens son para la comisión de los trabajos en efectivo.',
      'On: tokens pay the commission at payout first, so you keep more of the payout. You can turn this off on your Tokens page.': 'Activado: los tokens pagan primero la comisión al retirar, así que recibes más del retiro. Puedes desactivarlo en tu página de Tokens.',
      'Open Tokens': 'Abrir Tokens', 'You owe': 'Debes', 'of commission from a cash job.': 'de comisión de un trabajo en efectivo.',
      'Commission Statement': 'Estado de comisiones', 'Booking': 'Reserva', 'Service': 'Servicio', 'Job Amount': 'Monto del trabajo', 'Rate': 'Tasa', 'Commission': 'Comisión',
      'How It Is Paid': 'Cómo se paga', 'Status': 'Estado', 'Awaiting Completion': 'Pendiente de finalizar', 'Due at Next Payout': 'A pagar en el próximo retiro', 'Paid': 'Pagada', 'Returned': 'Devuelta', 'Not Charged': 'Sin cargo',
      'Taken from payout': 'Descontada del retiro', 'Tokens, then payout': 'Tokens y luego retiro', 'Paid with tokens': 'Pagada con tokens', 'Paid with tokens (cash job)': 'Pagada con tokens (efectivo)', 'Free-commission credit': 'Crédito sin comisión',
      'No commission yet. It appears here once you have a booking.': 'Todavía no hay comisiones. Aparecerán aquí cuando tengas una reserva.',
      'Show All': 'Mostrar todo', 'Show Less': 'Mostrar menos', 'token': 'token', 'tokens': 'tokens',
      'Could not load your commission details.': 'No se pudieron cargar los detalles de tu comisión.',
      'Earned': 'Ganado', 'How Commission Was Paid': 'Cómo se pagó la comisión', 'Paid Out': 'Pagado', 'Payout': 'Retiro', 'Method': 'Método',
      'Payout statement': 'Detalle del retiro', 'Earned from jobs': 'Ganado por trabajos', 'Store purchase fees': 'Cargos por compras en tienda', 'Plan fee': 'Cuota del plan',
      'Tips (no commission)': 'Propinas (sin comisión)', 'Paid to you': 'Pagado a ti', 'You receive': 'Recibes',
      'Taken from this payout': 'Descontada de este retiro', 'paid with tokens': 'pagada con tokens', 'taken from this payout': 'descontada de este retiro',
      'No commission was charged.': 'No se cobró comisión.', 'Jobs in this payout': 'Trabajos en este retiro',
      'Commission Received': 'Comisión recibida', 'Total commission': 'Comisión total', 'Taken from payouts': 'Descontada de retiros', 'Paid with tokens ': 'Pagada con tokens ',
      'Store fees': 'Cargos de tienda', 'Pro': 'Profesional', 'Type': 'Tipo', 'Reference': 'Referencia', 'How Paid': 'Cómo se pagó', 'Cash job': 'Trabajo en efectivo', 'Owed commission': 'Comisión adeudada',
      'No commission has been received yet.': 'Todavía no se ha recibido comisión.', 'Estimate until paid out': 'Estimado hasta el retiro', 'est.': 'est.',
      'Commission is taken when a pro requests a payout. On cash jobs, the pro pays it with tokens when they accept the job.': 'La comisión se descuenta cuando un profesional solicita un retiro. En trabajos en efectivo, el profesional la paga con tokens al aceptar el trabajo.',
      'Jobs included in Available for Payout': 'Trabajos incluidos en Disponible para retiro', 'Jobs awaiting completion by the customer': 'Trabajos pendientes de que el cliente los marque como completados',
      'Customer': 'Cliente', 'Job': 'Trabajo', 'Amount': 'Monto', 'Contract Status': 'Estado del contrato',
      'Nothing to show yet. Jobs appear here once a customer marks them complete.': 'Nada que mostrar todavía. Los trabajos aparecen aquí cuando el cliente los marca como completados.',
      'Nothing pending right now.': 'No hay nada pendiente ahora.', 'earned': 'ganado', 'commission': 'comisión', 'View details': 'Ver detalles',
      'Not active while LIVE SITE is ticked.': 'No funciona mientras SITIO EN VIVO esté marcado.',
      'On unless you turn it off. Trothen\'s commission is paid from tokens, so you keep the full amount you earned. If your tokens don\'t cover all of it, the rest comes out of the payout as usual.': 'Activado salvo que lo desactives. La comisión de Trothen se paga con tokens, así que recibes todo lo que ganaste. Si tus tokens no alcanzan, el resto se descuenta del retiro como siempre.',
      'On: tokens pay the commission at payout first, so you keep more of the payout.': 'Activado: los tokens pagan primero la comisión al retirar, así que recibes más del retiro.',
      'After commission is taken once the customer confirms': 'Después de descontar la comisión cuando el cliente confirme',
    });
  } catch (err) {}

  // ── Pro: Earnings & Payouts ──────────────────────────────────────────
  window.COMMISSION_SUMMARY = null;
  let showAllRows = false;

  function rateLine(s) {
    if (s.rateSource === 'override') return t('Custom rate approved by Trothen');
    if (s.rateSource === 'organization') return `${t('Organization rate')}${s.organizationName ? ` (${e(s.organizationName)})` : ''}`;
    return `${e(t(PLAN[s.plan] || 'Starter'))} ${t('plan')}`;
  }
  function dueLine(s) {
    const a = s.available;
    if (a.freeCreditApplies) return t('Your free-commission credit applies: no commission will be charged.');
    if (a.commissionWithTokens > 0 && a.commissionFromPayout > 0) return `${e(toks(a.commissionWithTokens))} ${t('paid with tokens')}, ${usd(a.commissionFromPayout)} ${t('taken from this payout')}.`;
    if (a.commissionWithTokens > 0) return `${t('Paid with tokens')}: ${e(toks(a.commissionWithTokens))}.`;
    return t('Taken from the payout when you request it.');
  }
  function tile(label, value, sub) {
    return `<div style="flex:1 1 200px;min-width:0;padding:14px 16px;border:1px solid var(--border);border-radius:10px;background:var(--white,#fff);">
      <div style="font-size:13px;color:var(--slate);">${label}</div>
      <div style="font-size:22px;font-weight:700;color:var(--navy);margin-top:2px;">${value}</div>
      <div style="font-size:12.5px;color:var(--slate);margin-top:4px;line-height:1.45;">${sub}</div></div>`;
  }
  function statementRowsHTML(rows) {
    if (!rows.length) return `<div style="color:var(--slate);font-size:14px;padding:8px 0;">${e(t('No commission yet. It appears here once you have a booking.'))}</div>`;
    const shown = showAllRows ? rows : rows.slice(0, 10);
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>${e(t('Date'))}</th><th>${e(t('Booking'))}</th><th>${e(t('Service'))}</th><th>${e(t('Job Amount'))}</th><th>${e(t('Rate'))}</th><th>${e(t('Commission'))}</th><th>${e(t('How It Is Paid'))}</th><th>${e(t('Status'))}</th></tr></thead><tbody>
      ${shown.map(r => `<tr>
        <td>${e(r.date || '')}</td>
        <td>${r.bookingNumber ? `#${e(r.bookingNumber)}` : ''}</td>
        <td>${e(r.service || '')}${r.note ? `<div style="font-size:12px;color:var(--slate);margin-top:2px;">${e(t(r.note))}</div>` : ''}</td>
        <td>${r.amount != null ? usd(r.amount) : ''}</td>
        <td>${e(pct(r.commissionRate))}</td>
        <td><strong>${commissionCell(r)}</strong></td>
        <td>${e(t(HOW[r.how] || r.how || ''))}</td>
        <td>${badge(r.status)}</td></tr>`).join('')}
      </tbody></table></div>
      ${rows.length > 10 ? `<div style="margin-top:10px;"><button class="btn-sm btn-sm-outline" onclick="commissionToggleRows()">${e(t(showAllRows ? 'Show Less' : 'Show All'))} (${rows.length})</button></div>` : ''}`;
  }
  window.commissionToggleRows = function () { showAllRows = !showAllRows; const w = document.getElementById('commission-statement-wrap'); if (w && window.COMMISSION_SUMMARY) w.innerHTML = statementRowsHTML(window.COMMISSION_SUMMARY.rows); };

  function panelHTML(s) {
    const a = s.available, tot = s.totals;
    const paidParts = [`${usd(tot.fromPayouts)} ${t('from payouts')}`];
    if (tot.withTokensAtPayout > 0) paidParts.push(`${e(toks(tot.withTokensAtPayout))} ${t('with tokens at payout')}`);
    if (tot.cashJobTokens > 0) paidParts.push(`${e(toks(tot.cashJobTokens))} ${t('on cash jobs')}`);
    const tokensOn = s.tokens && s.tokens.autopayCommission;
    const step = (n, title, text, extra) => `<div style="display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--border);">
      <div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:rgba(37,99,235,.1);color:#2563eb;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;">${n}</div>
      <div style="font-size:14px;color:var(--text);line-height:1.55;"><strong style="color:var(--navy);">${e(t(title))}.</strong> ${text}${extra || ''}</div></div>`;
    return `<div class="panel-title">${e(t('How Your Commission Is Paid'))}</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
        ${tile(e(t('Your commission rate')), e(pct(s.rate)), `${rateLine(s)}. ${e(t('Rides'))}: ${e(pct(s.rideRate))}. ${e(t('Tips and store goods: no commission.'))}`)}
        ${tile(e(t('Due at your next payout')), usd(a.commissionAmount), `${dueLine(s)}${a.grossAmount > 0 ? ` ${usd(a.grossAmount)} ${t('earned')}, ${t('You receive').toLowerCase()} ${usd(a.net)}.` : ''}`)}
        ${tile(e(t('Commission paid so far')), usd(tot.all), paidParts.join(' · '))}
      </div>
      ${step(1, 'Jobs paid through Trothen', e(t(tokensOn ? 'The customer\'s payment is held until they mark the job complete. When you request a payout, the commission is paid from your tokens first (see 3), and anything they do not cover is taken from the payout. You never pay it separately.' : 'The customer\'s payment is held until they mark the job complete. When you request a payout, Trothen\'s commission is taken out first and you receive the rest. You never pay it separately.')))}
      ${step(2, 'Cash jobs', e(t('The customer pays you directly, so the commission is paid with tokens when you accept the job. If the price changes or the job does not go ahead, the tokens are corrected or given back.')))}
      ${step(3, 'Tokens', e(t(tokensOn ? 'On: tokens pay the commission at payout first, so you keep more of the payout. You can turn this off on your Tokens page.' : 'Off: the commission is taken out of the job money before the rest is paid to you. Tokens are for the commission on cash jobs.')), ` <a onclick="selectProviderSection('tokens')" style="color:var(--teal);cursor:pointer;font-weight:600;white-space:nowrap;">${e(t('Open Tokens'))} →</a>`)}
      ${s.tokenDebt > 0 ? `<div style="margin-top:8px;padding:10px 12px;border-radius:8px;background:rgba(220,38,38,.08);color:#B42318;font-size:14px;">${e(t('You owe'))} ${e(toks(s.tokenDebt))} ${e(t('of commission from a cash job.'))}</div>` : ''}
      <div style="font-weight:700;color:var(--navy);margin:16px 0 8px;">${e(t('Commission Statement'))}</div>
      <div id="commission-statement-wrap">${statementRowsHTML(s.rows)}</div>`;
  }

  function fillCards(s) {
    const main = document.getElementById('provider-main'); if (!main) return;
    const a = s.available;
    const avail = main.querySelector('[onclick*="toggleEarningsBreakdown(\'available\')"]');
    if (avail) {
      const v = avail.querySelector('.stat-card-val'); if (v) v.textContent = usd(a.net);
      const sub = v && v.nextElementSibling; if (sub) sub.textContent = `${usd(a.grossAmount + a.tips)} ${t('earned')} − ${usd(a.commissionAmount)} ${t('commission')} (${pct(a.commissionRate)})${a.commissionWithTokens > 0 ? ` + ${usd(a.commissionWithTokens)} ${t('paid with tokens')}` : ''}${a.storeFeeAmount > 0 ? ` − ${usd(a.storeFeeAmount)}` : ''}${a.planFeeAmount > 0 ? ` − ${usd(a.planFeeAmount)}` : ''} · ${t('View details')}`;
    }
    const pend = main.querySelector('[onclick*="toggleEarningsBreakdown(\'pending\')"]');
    if (pend) {
      const rows = s.rows.filter(r => r.status === 'pending');
      const gross = rows.reduce((x, r) => x + (r.amount || 0), 0), com = rows.reduce((x, r) => x + (r.commission || 0), 0);
      const v = pend.querySelector('.stat-card-val'); const sub = v && v.nextElementSibling;
      if (sub) sub.textContent = `${t('After commission is taken once the customer confirms')}: ${usd(gross - com)} · ${t('View details')}`;
    }
  }

  async function loadCommissionPanel() {
    if (typeof BACKEND_AVAILABLE !== 'undefined' && !BACKEND_AVAILABLE) return;
    const main = document.getElementById('provider-main'); if (!main) return;
    let host = document.getElementById('commission-panel');
    if (!host) {
      host = document.createElement('div'); host.className = 'panel'; host.id = 'commission-panel';
      const anchor = document.getElementById('earnings-breakdown-panel') || main.querySelector('.stat-cards');
      if (!anchor) return;
      anchor.insertAdjacentElement('afterend', host);
    }
    try {
      const s = await apiFetch('GET', '/payouts/commission');
      window.COMMISSION_SUMMARY = s;
      if (!document.body.contains(host)) return;
      host.innerHTML = panelHTML(s);
      fillCards(s);
    } catch (err) { host.innerHTML = `<div style="color:var(--slate);font-size:14px;">${e(t('Could not load your commission details.'))}</div>`; }
  }
  window.loadCommissionPanel = loadCommissionPanel;
  if (typeof selectProviderSection === 'function') {
    const f = selectProviderSection;
    selectProviderSection = function (key) { const r = f.apply(this, arguments); if (key === 'earnings') { window.COMMISSION_SUMMARY = null; loadCommissionPanel(); } return r; };
  }

  // The two "click for details" cards on Earnings.
  let openWhich = null;
  window.toggleEarningsBreakdown = function (which) {
    const panel = document.getElementById('earnings-breakdown-panel'); if (!panel) return;
    if (openWhich === which) { panel.style.display = 'none'; openWhich = null; return; }
    openWhich = which;
    const s = window.COMMISSION_SUMMARY;
    let rows;
    if (s) {
      rows = which === 'available'
        ? s.available.lines.map(l => ({ customer: l.customerName, service: l.service, amount: l.amount, rate: l.commissionRate, commission: l.commission, receive: l.youReceive, note: l.note }))
        : s.rows.filter(r => r.status === 'pending').map(r => ({ customer: (providerData.contracts.find(c => c.id === r.contractId) || {}).customer, service: r.service, amount: r.amount, rate: r.commissionRate, commission: r.commission, receive: Math.round((r.amount - r.commission) * 100) / 100, note: r.note }));
    } else {
      const list = which === 'available'
        ? providerData.contracts.filter(c => c.escrow && c.escrow.status === 'released' && !c.escrow.payoutId)
        : providerData.contracts.filter(c => c.escrow && c.escrow.status === 'held');
      rows = list.map(c => ({ customer: c.customer, service: c.service, amount: c.escrow.amount, rate: null, commission: null, receive: null }));
    }
    const title = which === 'available' ? 'Jobs included in Available for Payout' : 'Jobs awaiting completion by the customer';
    panel.innerHTML = `<div class="panel-title">${e(t(title))}</div>
      ${rows.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>${e(t('Customer'))}</th><th>${e(t('Job'))}</th><th>${e(t('Amount'))}</th><th>${e(t('Rate'))}</th><th>${e(t('Commission'))}</th><th>${e(t('You receive'))}</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${e(r.customer || '')}</td><td>${e(r.service || '')}${r.note ? `<div style="font-size:12px;color:var(--slate);margin-top:2px;">${e(t(r.note))}</div>` : ''}</td><td>${usd(r.amount)}</td><td>${e(pct(r.rate))}</td><td>${r.commission != null ? usd(r.commission) : ''}</td><td><strong>${r.receive != null ? usd(r.receive) : ''}</strong></td></tr>`).join('')}
        </tbody></table></div>`
      : `<div style="color:var(--slate);font-size:14px;padding:8px 0;">${e(t(which === 'available' ? 'Nothing to show yet. Jobs appear here once a customer marks them complete.' : 'Nothing pending right now.'))}</div>`}`;
    panel.style.display = 'block';
  };

  // Payout History: each payout says how its commission was paid.
  function howPaid(p) {
    const com = p.commissionAmount || 0, tok = p.commissionPaidWithTokens || 0;
    if (p.freeCommissionCreditUsed || p.commissionRateSource === 'credit') return t('Free-commission credit');
    if (!(com > 0)) return t('No commission was charged.');
    if (tok >= com) return `${t('Paid with tokens')} (${toks(tok)})`;
    if (tok > 0) return `${toks(tok)} ${t('paid with tokens')}, ${usd(com - tok)} ${t('taken from this payout')}`;
    return t('Taken from this payout');
  }
  function statementHTML(p) {
    const com = p.commissionAmount || 0, tok = p.commissionPaidWithTokens || 0;
    const gross = p.grossAmount != null ? p.grossAmount : p.amount;
    const store = p.storeFeeAmount || 0, plan = p.planFeeAmount || 0;
    let tips = p.tipsAmount;
    if (tips == null) { tips = Math.round((p.amount - (gross - com + tok - store - plan)) * 100) / 100; if (!(tips > 0.004)) tips = 0; }
    const line = (label, value, sub, strong) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;${strong ? 'border-top:1px solid var(--border);margin-top:4px;padding-top:8px;font-weight:700;color:var(--navy);' : ''}"><span>${label}${sub ? `<div style="font-size:12px;color:var(--slate);font-weight:400;">${sub}</div>` : ''}</span><span style="white-space:nowrap;">${value}</span></div>`;
    return `<div style="padding:12px 16px;background:var(--white,#fff);font-size:14px;max-width:560px;">
      <div style="font-weight:700;color:var(--navy);margin-bottom:4px;">${e(t('Payout statement'))}</div>
      ${line(e(t('Earned from jobs')), usd(gross))}
      ${line(`${e(t('Commission'))}${p.commissionRate != null ? ` (${e(pct(p.commissionRate))})` : ''}`, com > 0 ? `−${usd(com)}` : usd(0), e(howPaid(p)))}
      ${tok > 0 && com > 0 ? line(e(t('Paid with tokens')), `+${usd(tok)}`) : ''}
      ${store > 0 ? line(e(t('Store purchase fees')), `−${usd(store)}`) : ''}
      ${plan > 0 ? line(e(t('Plan fee')), `−${usd(plan)}`) : ''}
      ${tips > 0 ? line(e(t('Tips (no commission)')), `+${usd(tips)}`) : ''}
      ${line(e(t('Paid to you')), p.payoutAmountLocal ? `${e(p.payoutCurrency)} ${e(p.payoutAmountLocal)} (≈ ${usd(p.amount)})` : usd(p.amount), '', true)}
    </div>`;
  }
  window.payoutHistoryTableHTML = function (payouts) {
    if (!payouts.length) return `<div style="color:var(--slate);font-size:14px;padding:12px 0;">${e(t('No payouts in this range.'))}</div>`;
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th></th><th>${e(t('Payout'))}</th><th>${e(t('Date'))}</th><th>${e(t('Earned'))}</th><th>${e(t('Commission'))}</th><th>${e(t('How Commission Was Paid'))}</th><th>${e(t('Paid Out'))}</th><th>${e(t('Method'))}</th><th>${e(t('Status'))}</th></tr></thead><tbody>
      ${payouts.map(p => `
        <tr style="cursor:pointer;" onclick="togglePayoutBreakdown('${e(p.id)}')">
          <td><span id="payout-caret-${e(p.id)}">▸</span></td>
          <td>${e(p.id)}</td><td>${e(p.date)}</td><td>${usd(p.grossAmount != null ? p.grossAmount : p.amount)}</td>
          <td>${p.commissionAmount ? `${usd(p.commissionAmount)} (${e(pct(p.commissionRate || 0))})` : usd(0)}</td>
          <td>${e(howPaid(p))}</td>
          <td><strong>${usd(p.amount)}</strong></td><td>${e(p.method)}</td><td>${statusBadge(p.status)}</td>
        </tr>
        <tr id="payout-breakdown-${e(p.id)}" style="display:none;">
          <td colspan="9" style="background:var(--offwhite);padding:0;">
            ${statementHTML(p)}
            ${p.lineItems && p.lineItems.length ? `
              <div style="padding:12px 16px;font-size:13px;color:var(--slate);font-weight:600;">${e(t('Jobs in this payout'))}: ${p.lineItems.filter(li => li.kind !== 'tip' && !/\(tip/.test(li.service || '')).length}</div>
              ${p.lineItems.map(li => payoutLineItemDetailHTML(li)).join('')}
            ` : ''}
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
  };
  if (typeof payoutLineItemDetailHTML === 'function') {
    const base = payoutLineItemDetailHTML;
    window.payoutLineItemDetailHTML = function (li) {
      const html = base(li);
      if (typeof li.commission !== 'number') return html;
      const extra = `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--offwhite);font-size:13px;color:var(--text);">
        ${e(t('Commission'))}: <strong>${usd(li.commission)}</strong>${li.commissionRate != null ? ` (${e(pct(li.commissionRate))})` : ''}${li.storeFee > 0 ? ` · ${e(t('Store purchase fees'))}: ${usd(li.storeFee)}` : ''} · ${e(t('You receive'))}: <strong>${usd(li.youReceive != null ? li.youReceive : li.amount - li.commission)}</strong>
        ${li.commissionNote ? `<div style="color:var(--slate);font-size:12px;margin-top:2px;">${e(t(li.commissionNote))}</div>` : ''}</div>`;
      const i = html.lastIndexOf('</div>');
      return i > -1 ? html.slice(0, i) + extra + html.slice(i) : html + extra;
    };
  }

  // ── Admin: Payments ──────────────────────────────────────────────────
  const ADMIN_HOW = (r) => {
    if (r.freeCredit) return t('Free-commission credit');
    if (r.kind === 'cashjob' || r.kind === 'debt') return t('Paid with tokens (cash job)');
    if (r.withTokens > 0 && r.fromPayout > 0) return `${toks(r.withTokens)} ${t('paid with tokens')}, ${usd(r.fromPayout)} ${t('taken from this payout')}`;
    if (r.withTokens > 0) return t('Paid with tokens');
    return t('Taken from payout');
  };
  const KIND = { payout: 'Payout', cashjob: 'Cash job', debt: 'Owed commission' };
  function ledgerHTML(d) {
    const rows = d.rows || [], tot = d.totals || {};
    const shown = rows.slice(0, 50);
    return `<div class="panel-title">${e(t('Commission Received'))}</div>
      <div style="font-size:13.5px;color:var(--slate);margin-bottom:12px;">${e(t('Commission is taken when a pro requests a payout. On cash jobs, the pro pays it with tokens when they accept the job.'))}</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
        ${tile(e(t('Total commission')), usd(tot.commission), '')}
        ${tile(e(t('Taken from payouts')), usd(tot.fromPayout), '')}
        ${tile(e(t('Paid with tokens')), e(toks(tot.withTokens)), '')}
        ${tot.storeFee > 0 ? tile(e(t('Store fees')), usd(tot.storeFee), '') : ''}
      </div>
      ${rows.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>${e(t('Date'))}</th><th>${e(t('Pro'))}</th><th>${e(t('Type'))}</th><th>${e(t('Reference'))}</th><th>${e(t('Earned'))}</th><th>${e(t('Rate'))}</th><th>${e(t('Commission'))}</th><th>${e(t('How Paid'))}</th><th>${e(t('Status'))}</th></tr></thead><tbody>
        ${shown.map(r => `<tr>
          <td>${e(r.date)}</td><td>${e(r.providerName)}</td><td>${e(t(KIND[r.kind] || r.kind))}</td>
          <td>${r.kind === 'cashjob' && r.reference ? '#' : ''}${e(r.reference || '')}${r.bookings && r.bookings.length && r.kind === 'payout' ? `<div style="font-size:12px;color:var(--slate);">${e(t('Booking'))} ${r.bookings.map(b => '#' + e(b)).join(', ')}</div>` : ''}</td>
          <td>${r.earned != null ? usd(r.earned) : ''}</td><td>${e(pct(r.commissionRate))}</td>
          <td><strong>${r.kind === 'payout' ? usd(r.commission) : e(toks(r.commission))}</strong></td>
          <td>${e(ADMIN_HOW(r))}</td>
          <td>${r.kind === 'payout' ? statusBadge(r.status) : badge(r.status)}</td></tr>`).join('')}
        </tbody></table></div>`
      : `<div style="color:var(--slate);font-size:14px;padding:8px 0;">${e(t('No commission has been received yet.'))}</div>`}`;
  }
  async function loadCommissionLedger() {
    if (typeof BACKEND_AVAILABLE !== 'undefined' && !BACKEND_AVAILABLE) return;
    const main = document.getElementById('admin-main'); if (!main) return;
    let host = document.getElementById('admin-commission-panel');
    if (!host) {
      const region = document.getElementById('admin-financial-region-wrap');
      const anchor = (region && region.closest('.panel')) || main.querySelector('.stat-cards'); if (!anchor) return;
      host = document.createElement('div'); host.className = 'panel'; host.id = 'admin-commission-panel';
      anchor.insertAdjacentElement('afterend', host);
    }
    const from = (document.getElementById('fin-filter-from') || {}).value, to = (document.getElementById('fin-filter-to') || {}).value;
    const q = new URLSearchParams(); if (from) q.set('from', from); if (to) q.set('to', to);
    try { const d = await apiFetch('GET', `/admin/commission-ledger?${q.toString()}`); if (document.body.contains(host)) host.innerHTML = ledgerHTML(d); }
    catch (err) { host.remove(); } // this admin account does not cover payments
  }
  if (typeof selectAdminSection === 'function') {
    const f = selectAdminSection;
    selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'payments') loadCommissionLedger(); return r; };
  }
  if (typeof filterAdminFinancials === 'function') {
    const f = filterAdminFinancials;
    filterAdminFinancials = async function () { const r = await f.apply(this, arguments); loadCommissionLedger(); return r; };
  }

  const TX_HOW = { payout: 'Taken from payout', tokens: 'Paid with tokens', 'payout+tokens': 'Tokens, then payout', 'cash-tokens': 'Paid with tokens (cash job)', free: 'Free-commission credit' };
  if (typeof adminTransactionsTableHTML === 'function') {
    const base = adminTransactionsTableHTML;
    window.adminTransactionsTableHTML = function (transactions) {
      const html = base(transactions);
      if (!transactions.length) return html;
      // Swap the estimate column for the real commission where it has been charged.
      const box = document.createElement('div'); box.innerHTML = html;
      const head = [...box.querySelectorAll('thead th')]; const col = head.findIndex(th => /Commission/.test(th.textContent));
      if (col < 0) return html;
      head[col].textContent = t('Commission');
      box.querySelectorAll('tbody tr').forEach((tr, i) => {
        const x = transactions[i]; const td = tr.children[col]; if (!x || !td) return;
        if (x.commission != null) td.innerHTML = `<strong>${x.commissionHow === 'cash-tokens' ? e(toks(x.commission)) : usd(x.commission)}</strong><div style="font-size:12px;color:var(--slate);">${e(t(TX_HOW[x.commissionHow] || ''))}</div>`;
        else if (x.estCommission != null) td.innerHTML = `${usd(x.estCommission)} <span style="font-size:12px;color:var(--slate);">${e(t('est.'))}</span><div style="font-size:12px;color:var(--slate);">${e(t('Estimate until paid out'))}</div>`;
      });
      return box.innerHTML;
    };
  }
})();
