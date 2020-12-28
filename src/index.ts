import transactionCollection from "./dbPool";
import puppet from "puppeteer";
import { promisify } from "util";
import { Transaction as PlaidTransaction } from "plaid";
import express from "express";

interface Transaction extends PlaidTransaction {
  complete?: boolean;
}

const timeoutAsync = promisify(setTimeout);

async function run() {
  const collection = await transactionCollection();

  const incomplete = await collection
    .find<Transaction>({ $and: [{ complete: { $ne: true } }, { account_id: { $eq: process.env.ACCOUNT_FILTER! } }] }) //TODO: test account filter
    .toArray();

  console.log(`found ${incomplete.length} incomplete transactions`);

  // incomplete.push({
  //   date: "12/27/2020",
  //   amount: 100,
  //   name: "test",
  //   transaction_id: "dunno"
  // } as any);

  if (incomplete.length === 0) return;

  const browser = await puppet.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(process.env.GOTO_PATH!);

  await timeoutAsync(5000);

  await page.type("#email", process.env.ED_EMAIL!, {
    delay: 100
  });

  await page.type("#password", process.env.ED_PASSWORD!, {
    delay: 100
  });

  await page.click("button[type='submit']");

  await timeoutAsync(5 * 1000);

  if (
    await page.waitForSelector("#Modal_close", {
      timeout: 2 * 1000
    })
  ) {
    await page.click("#Modal_close");
    await timeoutAsync(1 * 1000);
  }

  await page.click(".IconTray-icon--pulse");
  await timeoutAsync(1 * 1000);

  for (const transaction of incomplete) {
    await page.click("#TransactionDrawer_addNew");
    await timeoutAsync(1 * 1000);

    if (transaction.amount! < 0) {
      await page.click("#TransactionModal_typeIncome");
      await timeoutAsync(1 * 1000);
    }

    await page.type("#input-4.TransactionForm-amountInput", Math.abs(transaction.amount!).toFixed(2), {
      delay: 100
    });

    await page.focus("#input-5");
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(transaction.date, {
      delay: 100
    });
    await page.type("#input-6", `${transaction.name ?? transaction.merchant_name} (auto)`, {
      delay: 100
    });
    await page.click("#TransactionModal_submit");

    await collection.updateOne({ transaction_id: { $eq: transaction.transaction_id } }, { $set: { complete: true } });

    await timeoutAsync(1 * 1000);
  }

  await page.close();
}

const app = express();

app.get("*", async (_req, res) => {
  try {
    await run();
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

app.listen(process.env.PORT, () => {
  console.log("app started on port:", process.env.PORT);
});
