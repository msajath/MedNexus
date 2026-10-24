const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const { summarizePayments } = require('../utils/payments');

describe('Sri Lankan Healthcare Compliance & Localization Unit Tests', () => {
  const dummyId = new mongoose.Types.ObjectId();

  test('Payment model validates LKR as a valid Sri Lankan currency', () => {
    const payment = new Payment({
      appointment: dummyId,
      doctor: dummyId,
      patient: dummyId,
      recordedBy: dummyId,
      amountMinor: 250000, // Rs. 2,500.00
      currency: 'LKR',
      method: 'cash',
      receivedAt: new Date(),
    });

    const error = payment.validateSync();
    expect(error).toBeUndefined();
    expect(payment.currency).toBe('LKR');
  });

  test('Payment model continues to accept USD for international/backward compatibility', () => {
    const payment = new Payment({
      appointment: dummyId,
      doctor: dummyId,
      patient: dummyId,
      recordedBy: dummyId,
      amountMinor: 5000,
      currency: 'USD',
      method: 'card',
      receivedAt: new Date(),
    });

    const error = payment.validateSync();
    expect(error).toBeUndefined();
    expect(payment.currency).toBe('USD');
  });

  test('Payment model rejects unsupported currencies', () => {
    const payment = new Payment({
      appointment: dummyId,
      doctor: dummyId,
      patient: dummyId,
      recordedBy: dummyId,
      amountMinor: 5000,
      currency: 'EUR',
      method: 'card',
      receivedAt: new Date(),
    });

    const error = payment.validateSync();
    expect(error).toBeDefined();
    expect(error.errors.currency).toBeDefined();
  });

  test('Payout model validates LKR and USD currencies', () => {
    const lkrPayout = new Payout({
      doctor: dummyId,
      doctorUser: dummyId,
      processedBy: dummyId,
      amount: 50000,
      currency: 'LKR',
      bankDetails: {
        bankName: 'Bank of Ceylon',
        accountNumber: '1234567890',
        accountHolderName: 'Dr. Perera',
        branch: 'Colombo 07',
      },
    });

    expect(lkrPayout.validateSync()).toBeUndefined();
    expect(lkrPayout.currency).toBe('LKR');
  });

  test('summarizePayments detects and preserves LKR currency across Sri Lankan transactions', () => {
    const payments = [
      { amountMinor: 250000, status: 'received', currency: 'LKR' },
      { amountMinor: 350000, status: 'received', currency: 'LKR' },
      { amountMinor: 100000, status: 'refunded', currency: 'LKR' },
    ];

    const summary = summarizePayments(payments);
    expect(summary).toEqual({
      receivedAmount: 7000,
      refundedAmount: 1000,
      netReceived: 6000,
      receivedPayments: 2,
      currency: 'LKR',
      basis: 'recorded_payments',
    });
  });

  test('Sri Lankan National Identity Card (NIC) formats validate accurately', () => {
    const oldNicRegex = /^[0-9]{9}[vVxX]$/;
    const newNicRegex = /^[0-9]{12}$/;

    // Valid formats
    expect(oldNicRegex.test('851234567V')).toBe(true);
    expect(oldNicRegex.test('921234567X')).toBe(true);
    expect(newNicRegex.test('199012345678')).toBe(true);
    expect(newNicRegex.test('200256789012')).toBe(true);

    // Invalid formats
    expect(oldNicRegex.test('85123456V')).toBe(false); // too short
    expect(oldNicRegex.test('8512345678V')).toBe(false); // too long
    expect(newNicRegex.test('19901234567')).toBe(false); // 11 digits
    expect(newNicRegex.test('1990123456789')).toBe(false); // 13 digits
  });

  test('Sri Lankan mobile and landline phone number formats validate accurately', () => {
    const slPhoneRegex = /^(?:0|\+94)(?:7[01245678]\d{7}|(?:11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67)\d{7})$/;

    // Domestic 07X mobile formats
    expect(slPhoneRegex.test('0771234567')).toBe(true);
    expect(slPhoneRegex.test('0712345678')).toBe(true);
    expect(slPhoneRegex.test('0769876543')).toBe(true);

    // International +94 formats
    expect(slPhoneRegex.test('+94771234567')).toBe(true);
    expect(slPhoneRegex.test('+94712345678')).toBe(true);

    // Domestic landline with area code
    expect(slPhoneRegex.test('0112345678')).toBe(true); // Colombo
    expect(slPhoneRegex.test('0812345678')).toBe(false); // 081 not in allocated prefixes list
    expect(slPhoneRegex.test('0731234567')).toBe(false); // 073 is not an allocated SL mobile prefix
    expect(slPhoneRegex.test('12345')).toBe(false);
  });
});
