# Forvique search API

Harness desktop searches a client's company documents through one small HTTP endpoint. Each client
server implements it in front of whatever holds their data: a vector database, a SQL or local
database, or a document store. Harness never connects to those systems directly.

## Request

```
POST {server URL}/search
Authorization: Bearer {access token}
Content-Type: application/json

{ "query": "when are invoices sent?", "k": 5 }
```

- `query`: the user's question, in plain language. Search by meaning when the store supports it.
- `k`: the most passages to return (1–20).

## Response

```
200 OK
Content-Type: application/json

{
  "passages": [
    {
      "text": "Invoices are sent on the first day of each month.",
      "source": "finance/billing-policy.pdf",
      "location": "page 3",
      "score": 0.82
    }
  ]
}
```

- `text` (required): the passage itself, a few sentences to a few paragraphs.
- `source` (required): what the user would call the document, such as a file path, title or record id.
- `location` (optional): where in the source, such as "page 3", "line 120" or "section 2.1".
- `score` (optional): the server's own relevance score. Harness shows it but never compares it with other sources.

Passages missing `text` or `source` are dropped.

## Errors

- Any non-2xx status is shown to the user as "{server name}: HTTP {status}".
- Harness waits 15 seconds, then reports the server as unreachable. Other sources still answer.

## Security

- Serve over HTTPS in production. Harness accepts `http://` only so local development works.
- Check the Bearer token on every request and scope it to what that client may read.
- The token is entered in Harness Settings and stored on the user's device, encrypted with the
  operating system's credential store. It is never sent to the Harness agent or the model provider.
- Passages are sent to the model the user picked, so return only what that user may see.
