import transactionCollection from "./dbPool";
import puppet from "puppeteer-core";
import { promisify } from "util";
import { Transaction as PlaidTransaction } from "plaid";

interface Transaction extends PlaidTransaction {
  complete?: boolean;
}

const timeoutAsync = promisify(setTimeout);

(async function () {
  const collection = await transactionCollection();

  const incomplete = await collection
    .find<Transaction>({ $and: [{ complete: { $ne: true } }, { account_id: { $eq: process.env.ACCOUNT_FILTER! } }] }) //TODO: test account filter
    .toArray();

  console.log(`found ${incomplete.length} incomplete transactions`);

  if (incomplete.length === 0) process.exit(0);

  const browser = await puppet.launch({
    headless: false,
    executablePath: process.env.BROWSER_PATH
  });

  const page = await browser.newPage();
  await page.goto("https://www.everydollar.com/app/budget");

  await timeoutAsync(5000);

  await page.type("#email", process.env.ED_EMAIL!, {
    delay: 100
  });

  await page.type("#password", process.env.ED_PASSWORD!, {
    delay: 100
  });

  await page.click("button[type='submit']");

  await timeoutAsync(5 * 1000);

  await page.click("#Modal_close");
  await timeoutAsync(1 * 1000);
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

  process.exit(0);
})();
