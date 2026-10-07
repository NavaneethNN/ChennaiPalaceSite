# Automatic printer detection and KOT printing

This guide describes the proposed setup for Chennai Palace: one cashier computer, one cashier printer, and one kitchen printer. The kitchen does not need a computer.

**Current status:** the website generates separate Kitchen and Cashier KOT PDFs. Automatic printer discovery, printer settings, and automatic physical printing still need to be implemented. Installing the software below alone will not enable those features.

## 1. Connect both printers to the cashier computer

Use this arrangement where the printer hardware supports it:

```text
Restaurant website in cashier browser
                  |
          Cashier computer
          running QZ Tray
             /         \
       USB or LAN    Restaurant LAN
           |              |
    Cashier printer  Kitchen printer
```

1. Record the cashier computer's operating system and each printer's model, connection options, and paper width.
2. Connect the cashier printer by USB or the restaurant network.
3. Prefer Ethernet for the kitchen printer if supported. Connect it to the same reachable restaurant network as the cashier computer.
4. Reserve the kitchen printer's IP address in the router so its address stays stable.
5. If the kitchen printer is USB-only, use a compatible connection to the cashier computer or a print server explicitly supported by its manufacturer. A generic USB-to-network adapter is not guaranteed to work.

No printer ports need to be exposed to the public internet.

## 2. Install and test the operating-system printers

1. Install the manufacturer's driver for each printer on the cashier computer.
2. Add both printers through the computer's printer settings, using the kitchen printer's network address where necessary.
3. Give the queues recognizable names, for example `CP-Cashier` and `CP-Kitchen`.
4. Set the paper size and print an operating-system test page from each queue.
5. Open an existing KOT PDF and print it manually to each printer. Check readability, margins, paper feeding, and cutting if supported.

For the current PDF approach, use a driver capable of printing PDFs through the operating system. A raw generic/text-only driver is insufficient for this workflow. [QZ driver guidance](https://qz.io/docs/faq)

The site's KOT generator currently uses approximately 80 mm paper width. A 58 mm printer needs an adjusted PDF layout and testing; do not assume automatic scaling will produce readable tickets.

## 3. Install the local printing bridge

Use **QZ Tray** on the cashier computer. It connects browser JavaScript to locally installed printers through a local WebSocket connection. Install it from the [official QZ website](https://qz.io/), launch it, and verify printer discovery using its bundled sample page or [official demo](https://demo.qz.io/). Configure it to launch when the cashier signs into the computer. [QZ getting started](https://qz.io/docs/getting-started)

Automatic detection means listing printer queues available to this computer. It does not install missing drivers, discover every unconfigured network printer, or determine which printer is physically in the kitchen.

## 4. Add printer discovery and destination settings to the site

**Developer implementation required:**

1. Add the QZ JavaScript client to the project and load it only in the staff browser interface.
2. Add an admin **Printer setup** screen with connection status, **Detect printers**, two destination selectors, and a test-print button for each destination.
3. Connect to QZ and retrieve printer names. The basic discovery sequence is:

   ```js
   // qz is the imported QZ client; production signing must be configured first.
   if (!qz.websocket.isActive()) {
     await qz.websocket.connect();
   }
   const availablePrinters = await qz.printers.find();
   ```

4. Have the admin make this one-time assignment:

   | Site destination | Installed printer queue, for example |
   | --- | --- |
   | Kitchen | `CP-Kitchen` |
   | Cashier | `CP-Cashier` |

5. Save the mapping against a registered cashier workstation, using the exact names returned by discovery. Restrict changes to the super admin.
6. Cashiers should see connection problems and retry controls, but should not change destination mappings.
7. Recheck the saved names after reconnecting. If a queue disappears, pause that destination and show an error instead of silently using the default printer.

These discovery APIs are documented in [QZ getting started](https://qz.io/docs/getting-started).

## 5. Configure trusted signing for silent printing

Printer detection and printing without approval dialogs are separate capabilities. QZ requires trusted message signing to suppress its warnings. For production, review the current certificate/support options; development demo certificates are for testing. [QZ signing requirements](https://qz.io/docs/signing) · [Certificate setup](https://qz.io/docs/generate-certificate)

The developer should:

1. Keep the signing private key in server-side secret storage. Never put it in `public/`, browser code, Git, or a `NEXT_PUBLIC_` variable.
2. Add authenticated certificate/signature integration using QZ's security callbacks.
3. Authorize signing requests: validate the staff session, workstation, allowed operation, destination, and print-job content. Do not create an endpoint that signs arbitrary client-supplied messages.
4. Use HTTPS for the deployed website and complete the initial trust setup on the cashier computer.
5. Document certificate renewal and test the connection after renewal.

## 6. Route each accepted order to its printers

**Proposed application flow:**

1. The cashier accepts an order through the existing acceptance endpoint.
2. In the same database transaction as acceptance, create a durable print job for each destination present in that order. Enforce uniqueness on order ID plus destination for the initial jobs.
3. The registered cashier workstation claims the jobs and fetches their PDFs with its authenticated browser session:

   ```text
   /api/kot/<order-id>?printer=kitchen
   /api/kot/<order-id>?printer=cashier
   ```

4. Send only each destination's PDF to its mapped printer. Skip destinations without items.
5. Fetch the protected PDF in the browser and pass its contents to QZ as base64 PDF data. Do not assume QZ's own URL fetch shares the browser's HttpOnly staff cookie. QZ supports PDF input, including base64. [QZ PDF printing](https://qz.io/docs/pixel)
6. Keep the existing PDF links as a manual fallback.

Replace the current automatic PDF-tab opening only after physical printing is enabled and tested. Use the order's saved printer destination, not a later edit to the menu item.

## 7. Handle failures and duplicate printing

Implement a database-backed queue before relying on automatic printing during service:

- Claim jobs atomically with a workstation lease so two browser tabs cannot submit the same job concurrently.
- Track queued, submitting, submitted, failed, and uncertain outcomes. Record attempts and staff-requested reprints.
- Recover pending jobs on reconnect; use live events as a notification, not as the only record of work to print.
- If acknowledgement is lost after submission, mark the outcome uncertain and ask the cashier to check the printer before reprinting. Exactly-once physical printing cannot be guaranteed across failures.
- A printing failure must not undo an accepted order or deduct stock again.
- Show a visible warning for an unavailable bridge or printer. Use printer status where supported, and do not treat successful submission as proof that paper emerged. [QZ printer status](https://qz.io/docs/printer-status)

## 8. Test before restaurant service

Verify all of these on the actual cashier computer:

| Test | Expected result |
| --- | --- |
| Kitchen-only order | Only the kitchen printer receives its KOT |
| Cashier-only order | Only the cashier printer receives its KOT |
| Mixed order | Each printer receives only its assigned items |
| Rejected order | No KOT is printed |
| Repeated acceptance or two open tabs | No duplicate initial print jobs |
| Printer unplugged or out of paper | Visible problem; order remains accepted |
| Connection lost during submission | Uncertain outcome requires checking before retry |
| Cashier computer restarted | QZ reconnects and pending jobs are recovered |
| Cashier account disabled | Further authorized job claims/signing are denied |
| Long order and customer notes | All text prints legibly without clipping |

Keep the cashier computer awake, QZ running, and the cashier workspace open during service. This browser-driven design does not process jobs while the browser is closed; that would require a separate background worker on the cashier computer.

After implementation, daily use is: power on both printers, open the cashier workspace, confirm printer readiness, and accept orders. KOTs then go to their assigned destinations without selecting a printer for every order.
