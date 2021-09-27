const Client = require("xrpl-client").XrplClient;
const { parseBalanceChanges } = require('ripple-lib-transactionparser')

const { hex2string, string2hex } = require("./str_to_hex.js");


const app = async (account, cb) => {
  const display = result => {
    if (result?.transactions) {
      result?.transactions.forEach(r => {
        const {tx, meta} = r
        let direction = 'other'
        if (tx?.Account === account) direction = 'sent'
        if (tx?.Destination === account) direction = 'received'  
        const moment = (new Date((tx.date + 946684800) * 1000)).toISOString()
        const balanceChanges = parseBalanceChanges(meta)
        if (Object.keys(balanceChanges).indexOf(account) > -1) {
          const mutations = balanceChanges[account]
          mutations.forEach(mutation => {
            const currency =
              mutation.counterparty === ""
                ? "XRP"
                : `${mutation.counterparty}.${convertCurrency(mutation.currency)}`;

            let isFee = direction === 'sent' && Number(mutation.value) * -1 * 1000000 === Number(tx?.Fee)
              ? 1
              : 0

            const fee = direction === 'sent'
            ? Number(tx?.Fee) / 1000000 * -1
              : 0
              
            let action = "";
            
            if (mutation.value == fee) {
              action = 'SENDFEE';
              isFee = 0
             }
            
            switch (tx.TransactionType) {
              case "OfferCreate":
                if (mutation.value > 0) {
                  direction = "received";
                } else {
                  direction = "sent";
                }
                break;
              default:
                break;
            }
            
            if (action === '') {
              if (direction === "sent") {
                action = "REDUCE";
              } else if (direction === "received") {
                action = "TIP";
              }
            }
            // - timestamp
            // - Action(BUY/SELL/PAY/MINING/SENDFEE/TIP/REDUCE/BONUS/LENDING/STAKING/CASH/BORROW/RETURN)
            // - Source (XRP Ledger)
            // - Base
            // - DerivType()
            // - DerivDetails
            // - Volume
            // - Price
            // - Counter
            // - Fee
            // - FeeCcy
            // - Comment

            cb({
              timestamp: moment,
              action: action,
              //"BUY/SELL/PAY/SENDFEE/TIP/REDUCE/BONUS/LENDING/STAKING",
              source: "XRP Ledger",
              base: currency,
              derivType: "",
              derivDetails: "",
              volume: mutation.value,
              price: "",
              counter: currency === "XRP" ? "JPY" : "XRP",
              fee: isFee === 1 ? fee : 0,
              feeCcy: isFee === 1 ? "XRP" : "",
              comment: tx.TransactionType + " / " + tx.hash,
              transactionType: tx.TransactionType,
            });
          })
        }
      })
    }
  }

  const client = new Client()

  const getMore = async marker => {
    const result = await client.send({
      command: 'account_tx',
      account,
      limit: 10,
      marker
    })
  
    display(result)
    return result?.marker
  }

  let proceed = await getMore()

  while (proceed) {
    proceed = await getMore(proceed)
  }

  client.close()
}


const fields = [
  "timestamp",
  "action",
  "source",
  "base",
  "derivType",
  "derivDetails",
  "volume",
  "price",
  "counter",
  "fee",
  "feeCcy",
  "comment",
  "transactionType",
];


let FieldEnum
fields.forEach((fieldName, idx) => {
  FieldEnum = {
    ...FieldEnum,
    [fieldName]: idx
  }
})


function convertCurrency(currency) {
  if (currency.length > 3) {
    return hex2string(currency).replace(/\0/g, "");
  } else {
    return currency
  }
}

const RippleAPI = require("ripple-lib").RippleAPI;
const api = new RippleAPI({
  server: "wss://s1.ripple.com", // Public rippled server
});

const getPriceData = async (address, transactions) => {
  await api.connect()
  const result = await transactions.map(async (tx)=> {
    return await Promise.all(fields.map((field) => {
      if (field === 'price' && tx['transactionType'] !== 'OfferCreate' && tx.base !== 'XRP' && tx.counter === 'XRP') {
        const [counterparty, currency] = tx.base.split(".");
        const base = {
          currency:
            currency.length === 3
              ? currency
              : string2hex(currency).toUpperCase().padEnd(40, "0"),
          counterparty: counterparty,
        };
        const counter = {
          currency: tx.counter
        };
        const price = getPrice(address, base, counter);
        return String(price)
      }else{
        return String(tx[field]);
      }
    }));
  })
  // await api.disconnect()
  return result
}

async function getPrice(address, base, counter) {
  const orderbook = {
    base,
    counter,
  };
  const options = {
    ledgerVersion: undefined,
     limit: 1,
  }

  const result = await api.getOrderbook(address, orderbook, options);

  return result
}

module.exports = {
  app,
  fields,
  getPriceData,
  string2hex,
};
