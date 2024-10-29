import '@total-typescript/ts-reset';

import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import pino from 'pino';

const logger = pino();

export interface BatchStorage {
  traceId: string;
}

export interface PaymentStorage extends BatchStorage {
  spanId: string;
}

export const batchStorage = new AsyncLocalStorage<BatchStorage>();
export const paymentStorage = new AsyncLocalStorage<PaymentStorage>();

export type Payment = {
  id: string;
  amount: string;
  currency: string;
};

function getPaymentLogger() {
  const batchStore = batchStorage.getStore();
  const paymentStore = paymentStorage.getStore();
  return logger.child({
    traceId: batchStore?.traceId,
    spanId: paymentStore?.spanId,
  });
}

async function processPaymentBatch({ payments }: { payments: Payment[] }) {
  const logger = getPaymentLogger();
  logger.info({ paymentCount: payments.length }, 'Processing payment batch');

  const paymentPromises = payments.map((payment) => {
    return paymentStorage.run(
      { ...batchStorage.getStore()!, spanId: crypto.randomUUID() },
      async () => {
        try {
          const processedPayment = await processPayment(payment);
          getPaymentLogger().info(
            { paymentId: processedPayment.id },
            'Payment processed successfully'
          );
        } catch (error) {
          getPaymentLogger().error(
            { paymentId: payment.id, error },
            'Failed to process payment'
          );
        }
      }
    );
  });

  await Promise.all(paymentPromises);
}

async function processPayment(payment: Payment) {
  const logger = getPaymentLogger();
  logger.info({ paymentId: payment.id }, 'Processing payment');

  await paymentStep('Step 1', payment);
  await paymentStep('Step 2', payment);
  await paymentStep('Step 3', payment);

  return payment;
}

async function paymentStep(stepName: string, payment: Payment) {
  const logger = getPaymentLogger();
  logger.info(
    { paymentId: payment.id, step: stepName },
    'Starting payment step'
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (Math.random() > 0.8) {
    throw new Error(`Payment failed at ${stepName}`);
  }

  logger.info(
    { paymentId: payment.id, step: stepName },
    'Payment step completed'
  );
}

batchStorage.run({ traceId: crypto.randomUUID() }, () => {
  const payments = [
    { id: '1', amount: '100', currency: 'USD' },
    { id: '2', amount: '200', currency: 'USD' },
    { id: '3', amount: '150', currency: 'EUR' },
  ];

  processPaymentBatch({ payments });
});
