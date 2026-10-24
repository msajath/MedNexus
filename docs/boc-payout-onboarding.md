# Bank of Ceylon salary payout connection

The owner confirmed Sri Lanka, LKR and Bank of Ceylon on 24 October 2026. The hospital does not currently have a bank API or bulk salary-transfer facility. Live transfers therefore remain disabled. Saving or cancelling a MedNexus payout request does not move money.

## Bank access needed

Ask the hospital's BOC branch or relationship manager for **CFlex Corporate salary payments and ERP/payment API integration** for the business account. BOC's [own launch announcement](https://www.linkedin.com/posts/bank-of-ceylon_bocflexcorporate-cflex-bankofceylon-activity-7495871195297275904-OZDz) identifies its corporate platform. The [local implementation partner's account](https://www.n-able.biz/nb-news/n-able-supports-bank-of-ceylons-launch-of-cflex-corporate-advancing-digital-cash-management/) describes payment initiation and transaction-status APIs. Those announcements do not provide an API specification or grant this hospital access.

Suggested request to give the bank:

> We want our MedNexus hospital system to prepare administrator-approved doctor salary payments in LKR from our Bank of Ceylon business account. Please advise how to enable CFlex Corporate salary payments and ERP/payment API integration. We need the sandbox and technical documentation for beneficiary validation, payment initiation, duplicate-request protection, transaction-status reconciliation and the bank's approval workflow. If only file upload is available to our account, please provide the current salary-file specification and result-file format.

Obtain the bank's approved integration documentation, sandbox access and account-specific setup instructions. Configure any issued secrets directly in the hosting provider's secret settings; do not commit them or paste them into chat. No bank request has been sent on the owner's behalf.

## Implementation boundary

The current portal reserves available earnings in a pending request. Only provider-confirmed completed transfers affect the paid balance. Pending, failed, cancelled and unverified historical entries must never be presented as proof of a transfer. Connecting a provider must not automatically send saved requests: the administrator must review and explicitly submit a request through the finished bank integration.

The existing booking credits and payout-creation route use USD. LKR support in the models and display formatter alone does not constitute a currency migration. Before enabling the BOC connection, implement booked-fee currency snapshots, separate USD/LKR balances and matching payout currencies. Preserve historical USD records; do not relabel them as LKR or invent an exchange rate. The bank's exact amount representation, identifiers, authentication and confirmation protocol must come from its specification.

No bank-specific API endpoints, upload formats or successful-transfer responses have been invented. End-to-end bank acceptance testing must use the bank's sandbox before live transfers are enabled.
