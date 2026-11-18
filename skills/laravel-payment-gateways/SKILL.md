---
name: laravel-payment-gateways
description: Master guide and unified multi-driver architecture for integrating Top 10 payment gateways (Stripe, bKash Tokenized Checkout, Binance Pay Crypto, PayPal, Razorpay, Paddle, Mollie, Adyen, Square, SSLCommerz) in Laravel 13 & PHP 8.6+ with webhook signature verification, atomic idempotency, and PCI-DSS compliance.
---

# Laravel 13 & Modern PHP 8.6+ Payment Gateway Architecture & Fintech Integrations

This skill provides an enterprise-grade, multi-driver architecture for integrating global and regional payment gateways into **Laravel 13** and **PHP 8.6+** applications. It establishes rigorous standards for **bKash Tokenized Checkout**, **Binance Pay (Crypto)**, and the **Top 10 Global Payment Gateways** with strict cryptographic signature verification, atomic idempotency locks, and PCI-DSS compliance.

---

## 🧭 The Top 10 Payment Gateways Matrix

| # | Gateway | Category / Region | Primary Rails | Key Security Protocol | Webhook Verification |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Stripe** | Global Leader | Credit/Debit Cards, Apple Pay, SEPA, Klarna | PCI-DSS SAQ A, 3D Secure 2 (SCA) | HMAC-SHA256 (`Stripe-Signature`) |
| **2** | **bKash** | South Asia / MFS Leader | Mobile Financial Services, Digital Wallet | Tokenized Checkout (Grant/Refresh Token) | Asymmetric Token + Payment Status Query |
| **3** | **Binance Pay** | Global Crypto Web3 | USDT, BTC, ETH, BNB (300+ Crypto) | SHA512-HMAC + Timestamp/Nonce Non-repudiation | Public Key Certificate / SHA512-HMAC |
| **4** | **PayPal / Braintree** | Global Wallets & Cards | PayPal Balance, Venmo, Pay in 4, Cards | OAuth 2.0 Bearer, Vault Tokenization | Webhook ID & CRC32/RSA Signature |
| **5** | **Razorpay** | India / APAC Leader | UPI, Netbanking, Credit Cards, BharatQR | PCI-DSS Level 1, Mandatory Order IDs | HMAC-SHA256 (`X-Razorpay-Signature`) |
| **6** | **Paddle** | Global SaaS Merchant of Record | Cards, PayPal, Wire Transfer, Global VAT | MoR Compliance, Tax Automation | Ed25519 or RSA-SHA256 Signatures |
| **7** | **Mollie** | Europe (iDEAL, Bancontact) | SEPA, iDEAL, Bancontact, Cartes Bancaires | European PSD2 / SCA Compliance | Idempotent Webhook Ping (`id` verification) |
| **8** | **Adyen** | Global Enterprise Omnichannel | 250+ Local Payment Methods, Global Cards | Point-of-Sale & Online Unified Commerce | HMAC-SHA256 Signature Calculation |
| **9** | **Square** | SMB & Unified POS / Web | In-person Terminal, Cards, Cash App Pay | OAuth 2.0, End-to-End Encryption | SHA256-HMAC (`x-square-hmacsha256-signature`) |
| **10**| **SSLCommerz** | Bangladesh Multi-Gateway | Cards (Visa/Mastercard/Amex), MFS (Nagad/Rocket)| 3D Secure, Dual-token IPN validation | MD5/SHA256 Validation Hash Query |

---

## 1. Unified Multi-Driver Payment Gateway Architecture

Use Laravel's native **Manager Pattern** to switch seamlessly between payment gateways via configuration (`config/payments.php`).

```mermaid
flowchart TD
    Client["Client / Checkout UI"] --> Controller["CheckoutController"]
    Controller --> DTO["ChargePayloadData (final readonly class)"]
    Controller --> Manager["PaymentGatewayManager (Driver Coordinator)"]
    
    subgraph Drivers["Payment Gateway Drivers"]
        Manager --> Stripe["StripeDriver"]
        Manager --> Bkash["BkashDriver (Tokenized)"]
        Manager --> Binance["BinancePayDriver (Crypto)"]
        Manager --> Razorpay["RazorpayDriver"]
    end
    
    Drivers --> API["External Gateway API / Webhook"]
    API --> WebhookController["Unified WebhookController"]
    WebhookController --> Verifier["HMAC / Certificate Verifier (hash_equals)"]
    Verifier --> Action["TransitionOrderStatusAction"]
    Action --> DB[("Database (Deadlock Retry: 3)")]
```

### Payment Contract (`app/Contracts/Payments/PaymentGatewayInterface.php`)

```php
<?php

declare(strict_types=1);

namespace App\Contracts\Payments;

use App\Data\Payments\ChargePayloadData;
use App\Data\Payments\PaymentResponseData;
use App\Data\Payments\RefundPayloadData;
use App\Data\Payments\RefundResponseData;
use Illuminate\Http\Request;

interface PaymentGatewayInterface
{
    /**
     * Initiate a charge or generate a checkout redirect / QR payload.
     */
    public function charge(ChargePayloadData $payload): PaymentResponseData;

    /**
     * Verify and process incoming webhook payload from the gateway.
     */
    public function handleWebhook(Request $request): PaymentResponseData;

    /**
     * Execute a partial or full refund.
     */
    public function refund(RefundPayloadData $payload): RefundResponseData;

    /**
     * Query gateway transaction status directly (out-of-band verification).
     */
    public function query(string $transactionId): PaymentResponseData;
}
```

---

## 2. bKash Tokenized Checkout Integration Blueprint

bKash Tokenized Checkout (v1.2.0-beta) enables one-time payments and recurring token agreements in Bangladesh without exposing credentials.

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant App as Laravel Backend
    participant Bkash as bKash API Server

    Customer->>App: Click "Pay with bKash"
    App->>Bkash: POST /tokenized/checkout/create (Auth Token, Amount, Invoice)
    Bkash-->>App: Return paymentID & bkashURL
    App-->>Customer: Redirect to bkashURL
    Customer->>Bkash: Enter PIN & OTP on bKash Hosted Page
    Bkash-->>App: Redirect to Callback URL (?paymentID=...&status=success)
    App->>Bkash: POST /tokenized/checkout/execute (paymentID)
    Bkash-->>App: Return trxID, amount, status: Completed
    App->>App: Verify trxID via Query API & Update Order
    App-->>Customer: Display Order Confirmation
```

### Concrete bKash Driver (`app/Services/Payments/Drivers/BkashDriver.php`)

```php
<?php

declare(strict_types=1);

namespace App\Services\Payments\Drivers;

use App\Contracts\Payments\PaymentGatewayInterface;
use App\Data\Payments\ChargePayloadData;
use App\Data\Payments\PaymentResponseData;
use App\Data\Payments\RefundPayloadData;
use App\Data\Payments\RefundResponseData;
use App\Enums\PaymentStatus;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

final readonly class BkashDriver implements PaymentGatewayInterface
{
    private string $baseUrl;

    public function __construct(
        private HttpFactory $http,
        private string $appKey,
        private string $appSecret,
        private string $username,
        private string $password,
        bool $sandbox = false,
    ) {
        $this->baseUrl = $sandbox 
            ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta' 
            : 'https://tokenized.pay.bka.sh/v1.2.0-beta';
    }

    #[\Override]
    public function charge(ChargePayloadData $payload): PaymentResponseData
    {
        $token = $this->grantToken();

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $this->appKey,
                'Content-Type' => 'application/json',
            ])
            ->post('/tokenized/checkout/create', [
                'mode' => '0011',
                'payerReference' => $payload->customerPhone ?? 'N/A',
                'callbackURL' => route('payments.bkash.callback'),
                'amount' => number_format($payload->amountCents / 100, 2, '.', ''),
                'currency' => 'BDT',
                'intent' => 'sale',
                'merchantInvoiceNumber' => $payload->orderId,
            ])
            ->throw()
            ->json();

        return new PaymentResponseData(
            transactionId: $response['paymentID'],
            status: PaymentStatus::Pending,
            redirectUrl: $response['bkashURL'],
            raw: $response,
        );
    }

    /**
     * Execute the bKash payment after customer authorizes with PIN/OTP.
     */
    public function execute(string $paymentId): PaymentResponseData
    {
        $token = $this->grantToken();

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $this->appKey,
                'Content-Type' => 'application/json',
            ])
            ->post('/tokenized/checkout/execute', [
                'paymentID' => $paymentId,
            ])
            ->throw()
            ->json();

        $statusCode = $response['statusCode'] ?? '';
        $isSuccessful = $statusCode === '0000' && ($response['transactionStatus'] ?? '') === 'Completed';

        return new PaymentResponseData(
            transactionId: $response['trxID'] ?? $paymentId,
            status: $isSuccessful ? PaymentStatus::Paid : PaymentStatus::Failed,
            redirectUrl: null,
            raw: $response,
        );
    }

    #[\Override]
    public function query(string $transactionId): PaymentResponseData
    {
        $token = $this->grantToken();

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $this->appKey,
            ])
            ->post('/tokenized/checkout/payment/status', [
                'paymentID' => $transactionId,
            ])
            ->throw()
            ->json();

        $isCompleted = ($response['transactionStatus'] ?? '') === 'Completed';

        return new PaymentResponseData(
            transactionId: $response['trxID'] ?? $transactionId,
            status: $isCompleted ? PaymentStatus::Paid : PaymentStatus::Failed,
            redirectUrl: null,
            raw: $response,
        );
    }

    #[\Override]
    public function handleWebhook(Request $request): PaymentResponseData
    {
        $paymentId = $request->string('paymentID')->toString();
        return $this->query($paymentId);
    }

    #[\Override]
    public function refund(RefundPayloadData $payload): RefundResponseData
    {
        $token = $this->grantToken();

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders([
                'Authorization' => $token,
                'X-APP-Key' => $this->appKey,
            ])
            ->post('/tokenized/checkout/payment/refund', [
                'paymentID' => $payload->paymentId,
                'amount' => number_format($payload->amountCents / 100, 2, '.', ''),
                'trxID' => $payload->transactionId,
                'sku' => $payload->reason ?? 'Refund',
            ])
            ->throw()
            ->json();

        return new RefundResponseData(
            refundId: $response['refundTrxID'] ?? '',
            status: ($response['statusCode'] ?? '') === '0000',
            raw: $response,
        );
    }

    /**
     * Retrieve or refresh bKash access token with atomic Redis caching.
     */
    private function grantToken(): string
    {
        return Cache::remember('bkash_token', now()->addMinutes(50), function (): string {
            $response = $this->http->baseUrl($this->baseUrl)
                ->withHeaders([
                    'username' => $this->username,
                    'password' => $this->password,
                ])
                ->post('/tokenized/checkout/token/grant', [
                    'app_key' => $this->appKey,
                    'app_secret' => $this->appSecret,
                ])
                ->throw()
                ->json();

            return $response['id_token'] ?? throw new RuntimeException('Failed to retrieve bKash id_token.');
        });
    }
}
```

---

## 3. Binance Pay (Cryptocurrency Web3) Integration Blueprint

Binance Pay is a contactless, borderless cryptocurrency payment gateway supporting instant settlements in USDT, BTC, ETH, and 300+ crypto pairs.

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant App as Laravel Backend
    participant Binance as Binance Pay Open API

    Customer->>App: Click "Pay with Binance Crypto"
    App->>App: Generate Nonce (32-char) & Millisecond Timestamp
    App->>App: Compute SHA512-HMAC Signature
    App->>Binance: POST /binancepay/openapi/v2/order
    Binance-->>App: Return checkoutUrl & qrContent (Deep Link)
    App-->>Customer: Display Binance QR Code / Redirect to Web3 Checkout
    Customer->>Binance: Scan QR on Binance App & Confirm Payment
    Binance->>App: POST Webhook Notification
    App->>App: Verify Binance Signature via Public Key / HMAC
    App->>App: Idempotent Order State Update
    App-->>Binance: HTTP 200 {"returnCode": "SUCCESS"}
```

### Concrete Binance Pay Driver (`app/Services/Payments/Drivers/BinancePayDriver.php`)

```php
<?php

declare(strict_types=1);

namespace App\Services\Payments\Drivers;

use App\Contracts\Payments\PaymentGatewayInterface;
use App\Data\Payments\ChargePayloadData;
use App\Data\Payments\PaymentResponseData;
use App\Data\Payments\RefundPayloadData;
use App\Data\Payments\RefundResponseData;
use App\Enums\PaymentStatus;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

final readonly class BinancePayDriver implements PaymentGatewayInterface
{
    private string $baseUrl;

    public function __construct(
        private HttpFactory $http,
        private string $apiKey,
        private string $secretKey,
        bool $sandbox = false,
    ) {
        $this->baseUrl = $sandbox 
            ? 'https://bpay.binanceapi.com' 
            : 'https://bpay.binanceapi.com';
    }

    #[\Override]
    public function charge(ChargePayloadData $payload): PaymentResponseData
    {
        $endpoint = '/binancepay/openapi/v2/order';
        $body = [
            'env' => [
                'terminalType' => 'WEB',
            ],
            'merchantTradeNo' => $payload->orderId,
            'orderAmount' => number_format($payload->amountCents / 100, 2, '.', ''),
            'currency' => $payload->currency ?? 'USDT',
            'goods' => [
                'goodsType' => '02', // Virtual goods / digital checkout
                'goodsCategory' => 'Z000',
                'referenceGoodsId' => $payload->orderId,
                'goodsName' => 'Order #' . $payload->orderId,
            ],
            'returnUrl' => route('payments.binance.success', ['order' => $payload->orderId]),
            'cancelUrl' => route('payments.binance.cancel', ['order' => $payload->orderId]),
        ];

        $jsonPayload = json_encode($body, JSON_THROW_ON_ERROR);
        $headers = $this->generateHeaders($jsonPayload);

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders($headers)
            ->withBody($jsonPayload, 'application/json')
            ->post($endpoint)
            ->throw()
            ->json();

        if (($response['status'] ?? '') !== 'SUCCESS') {
            throw new RuntimeException("Binance Pay Error: " . ($response['errorMessage'] ?? 'Unknown'));
        }

        $data = $response['data'];

        return new PaymentResponseData(
            transactionId: (string) $data['prepayId'],
            status: PaymentStatus::Pending,
            redirectUrl: $data['checkoutUrl'],
            raw: $data,
        );
    }

    #[\Override]
    public function handleWebhook(Request $request): PaymentResponseData
    {
        // 1. Verify Binance Webhook Signature
        $timestamp = $request->header('BinancePay-Timestamp', '');
        $nonce = $request->header('BinancePay-Nonce', '');
        $signature = $request->header('BinancePay-Signature', '');
        $rawPayload = $request->getContent();

        $payloadToSign = $timestamp . "\n" . $nonce . "\n" . $rawPayload . "\n";
        $computedSignature = strtoupper(hash_hmac('sha512', $payloadToSign, $this->secretKey));

        if (! hash_equals($computedSignature, $signature)) {
            throw new RuntimeException('Invalid Binance Pay webhook signature.');
        }

        $data = $request->json('data');
        $bizStatus = $data['bizStatus'] ?? '';

        return new PaymentResponseData(
            transactionId: (string) ($data['merchantTradeNo'] ?? ''),
            status: $bizStatus === 'PAY_SUCCESS' ? PaymentStatus::Paid : PaymentStatus::Failed,
            redirectUrl: null,
            raw: $data,
        );
    }

    #[\Override]
    public function query(string $transactionId): PaymentResponseData
    {
        $endpoint = '/binancepay/openapi/v2/order/query';
        $body = ['merchantTradeNo' => $transactionId];
        $jsonPayload = json_encode($body, JSON_THROW_ON_ERROR);

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders($this->generateHeaders($jsonPayload))
            ->withBody($jsonPayload, 'application/json')
            ->post($endpoint)
            ->throw()
            ->json();

        $data = $response['data'];
        $isSuccess = ($data['status'] ?? '') === 'PAID';

        return new PaymentResponseData(
            transactionId: (string) $data['merchantTradeNo'],
            status: $isSuccess ? PaymentStatus::Paid : PaymentStatus::Pending,
            redirectUrl: null,
            raw: $data,
        );
    }

    #[\Override]
    public function refund(RefundPayloadData $payload): RefundResponseData
    {
        $endpoint = '/binancepay/openapi/v1/refund/order';
        $body = [
            'refundRequestId' => Str::ulid()->toBase32(),
            'prepayId' => $payload->transactionId,
            'refundAmount' => number_format($payload->amountCents / 100, 2, '.', ''),
            'refundReason' => $payload->reason ?? 'Customer Refund Request',
        ];

        $jsonPayload = json_encode($body, JSON_THROW_ON_ERROR);

        $response = $this->http->baseUrl($this->baseUrl)
            ->withHeaders($this->generateHeaders($jsonPayload))
            ->withBody($jsonPayload, 'application/json')
            ->post($endpoint)
            ->throw()
            ->json();

        return new RefundResponseData(
            refundId: (string) ($response['data']['refundId'] ?? ''),
            status: ($response['status'] ?? '') === 'SUCCESS',
            raw: $response,
        );
    }

    /**
     * Generate Binance Pay Non-Repudiation Authentication Headers.
     *
     * @return array<string, string>
     */
    private function generateHeaders(string $jsonPayload): array
    {
        $timestamp = (string) (int) (microtime(true) * 1000);
        $nonce = Str::random(32);
        $payloadToSign = $timestamp . "\n" . $nonce . "\n" . $jsonPayload . "\n";
        $signature = strtoupper(hash_hmac('sha512', $payloadToSign, $this->secretKey));

        return [
            'Content-Type' => 'application/json',
            'BinancePay-Timestamp' => $timestamp,
            'BinancePay-Nonce' => $nonce,
            'BinancePay-Certificate-SN' => $this->apiKey,
            'BinancePay-Signature' => $signature,
        ];
    }
}
```

---

## 4. Idempotency & Webhook Protection Rules

1. **Mandatory Double-Check via Webhook & Query API**: Never mark an order as `Paid` based solely on a frontend redirect. The frontend redirect must only display a "Processing Payment" state while the backend validates the transaction out-of-band via webhook or API query.
2. **Timing-Safe Signature Comparison**: Always use `hash_equals($expected, $actual)` to defend against timing side-channel attacks on webhook secrets.
3. **Idempotency Key Tracking**: Store `idempotency_key` and gateway `transaction_id` with unique database constraints to guarantee zero duplicate billings during network timeouts or retry storms.

```php
// In a dedicated Webhook Handler:
DB::transaction(attempts: 3, callback: function () use ($event, $gatewayResponse): void {
    $processed = ProcessedWebhook::where('event_id', $event->id)
        ->lockForUpdate()
        ->first();

    if ($processed !== null) {
        return; // Already processed idempotently
    }

    ProcessedWebhook::create([
        'event_id' => $event->id,
        'gateway' => 'binance',
        'payload' => $gatewayResponse->raw,
    ]);

    // Transition Order
    $order = Order::where('id', $gatewayResponse->transactionId)->lockForUpdate()->firstOrFail();
    $order->update(['status' => OrderStatus::Paid]);
});
```

---

## 5. Pest 3 Fintech & Payment Testing Suite

```php
declare(strict_types=1);

use App\Contracts\Payments\PaymentGatewayInterface;
use App\Data\Payments\ChargePayloadData;
use App\Enums\PaymentStatus;
use Illuminate\Support\Facades\Http;

test('bkash driver initiates tokenized checkout and returns payment url', function () {
    Http::fake([
        '*/token/grant' => Http::response(['id_token' => 'mock_token_123']),
        '*/checkout/create' => Http::response([
            'paymentID' => 'BK_12345678',
            'bkashURL' => 'https://tokenized.sandbox.bka.sh/checkout?paymentID=BK_12345678',
        ]),
    ]);

    $driver = app(PaymentGatewayInterface::class);
    $payload = new ChargePayloadData(orderId: 'ORD-101', amountCents: 150000, currency: 'BDT');

    $response = $driver->charge($payload);

    expect($response->status)->toBe(PaymentStatus::Pending)
        ->and($response->transactionId)->toBe('BK_12345678')
        ->and($response->redirectUrl)->toContain('checkout?paymentID=BK_12345678');
});

test('binance driver verifies webhook signature with constant time comparison', function () {
    $secret = 'mock_secret_key';
    $timestamp = '1690000000000';
    $nonce = 'abcdef1234567890abcdef1234567890';
    $rawPayload = json_encode(['bizStatus' => 'PAY_SUCCESS', 'data' => ['merchantTradeNo' => 'ORD-999']]);
    
    $payloadToSign = $timestamp . "\n" . $nonce . "\n" . $rawPayload . "\n";
    $signature = strtoupper(hash_hmac('sha512', $payloadToSign, $secret));

    expect(hash_equals($signature, strtoupper(hash_hmac('sha512', $payloadToSign, $secret))))->toBeTrue();
});
```
