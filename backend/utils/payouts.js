const toMinor = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000000 &&
  /^\d+(?:\.\d{1,2})?$/.test(String(value)) ? Math.round(value * 100) : null;

const summarizePayouts = payouts => {
  const confirmed = p => p.status === 'completed' && p.providerTransferId && p.providerConfirmedAt;
  const paidMinor = payouts.filter(confirmed).reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
  const reservedMinor = payouts.filter(p => ['pending', 'processing'].includes(p.status) || (p.status === 'completed' && !confirmed(p))).reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
  return { totalPaidOut: paidMinor / 100, reservedPayouts: reservedMinor / 100 };
};
const maskBank = bank => ({ bankName: bank?.bankName || '', accountNumber: bank?.accountNumber ? `****${bank.accountNumber.slice(-4)}` : '' });
const serializePayout = p => ({
  _id: p._id, doctor: p.doctor, doctorUser: p.doctorUser, amount: p.amount, currency: p.currency,
  bankDetails: maskBank(p.bankDetails), status: p.status === 'completed' && (!p.providerTransferId || !p.providerConfirmedAt) ? 'unverified' : p.status, reference: p.reference, notes: p.notes,
  processedBy: p.processedBy, processedAt: p.processedAt, createdAt: p.createdAt,
});
module.exports = { toMinor, summarizePayouts, maskBank, serializePayout };
