# External Website Order Integration Guide

This guide is for the developer who will connect an existing website, WooCommerce site, custom checkout, or Zapier flow to the POS order system.

## 1. What You Need

The shop owner will provide:

- Webhook URL
- API key

Keep the API key private. Do not expose it in public frontend JavaScript if the website has a backend/server available.

## 2. Webhook URL

Use the webhook URL shown in POS settings:

```txt
POST https://YOUR_API_DOMAIN/api/v1/external/orders
```

For local development this may look like:

```txt
POST http://localhost:5017/api/v1/external/orders
```

## 3. Required Headers

```txt
Content-Type: application/json
X-External-Order-Key: YOUR_API_KEY
```

## 4. Request Body

```json
{
  "customerName": "Rahim",
  "customerPhone": "01700000000",
  "customerAddress": "Dhaka",
  "items": [
    {
      "sku": "SKU-001",
      "qty": 1,
      "unitPrice": 500
    }
  ],
  "deliveryChargeCustomer": 80,
  "advancePaid": 0,
  "advancePaymentMethod": null,
  "note": "Placed from website",
  "externalOrderId": "WEB-1001",
  "sourceWebsiteUrl": "https://www.yourshopwebsite.com/"
}
```

## 5. Item Matching

Each item must include one of these:

- `sku`
- `barcode`
- `variantId`

Recommended for most old websites:

```json
{ "sku": "SKU-001", "qty": 1, "unitPrice": 500 }
```

## 6. JavaScript Example

Use this from a secure backend route when possible.

```js
async function sendOrderToPOS(order) {
  const response = await fetch("https://YOUR_API_DOMAIN/api/v1/external/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-External-Order-Key": "YOUR_API_KEY"
    },
    body: JSON.stringify({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      items: order.items.map((item) => ({
        sku: item.sku,
        qty: item.qty,
        unitPrice: item.unitPrice
      })),
      deliveryChargeCustomer: order.deliveryCharge || 0,
      advancePaid: order.advancePaid || 0,
      externalOrderId: order.orderId,
      sourceWebsiteUrl: "https://www.yourshopwebsite.com/"
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
```

## 7. Success Response

```json
{
  "success": true,
  "orderId": "00000000-0000-0000-0000-000000000000",
  "orderNo": "ORD-0001",
  "status": "DRAFT",
  "source": "EXTERNAL_WEBSITE",
  "externalOrderId": "WEB-1001"
}
```

The order will appear in POS Orders as a new draft order.

## 8. Common Errors

`401 Unauthorized`

The API key is missing, inactive, deleted, or incorrect.

`400 Bad Request`

Common causes:

- Missing customer name or phone
- Empty items list
- Quantity is zero or negative
- SKU/barcode/variantId does not match an active POS product

## 9. Zapier Setup

Use Webhooks by Zapier:

- Event: Custom Request
- Method: POST
- URL: the webhook URL from POS
- Headers:
  - `Content-Type`: `application/json`
  - `X-External-Order-Key`: API key from POS
- Data: use the JSON structure above

## 10. WooCommerce Setup

Recommended approach:

- Add a small server-side plugin/snippet that sends order data after checkout.
- Map WooCommerce product SKU to POS SKU.
- Send `externalOrderId` as the WooCommerce order number or ID.

Avoid sending the API key from browser-only JavaScript when possible.
