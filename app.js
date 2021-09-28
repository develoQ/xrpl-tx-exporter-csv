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
        const moment = new Date((tx.date + 946684800) * 1000).toISOString();
        const formattedMoment = formatDate(
          new Date((tx.date + 946684800) * 1000)
        );
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
              Timestamp: formattedMoment,
              ts: moment,
              Action: action,
              //"BUY/SELL/PAY/SENDFEE/TIP/REDUCE/BONUS/LENDING/STAKING",
              Source: "XRP Ledger",
              Base: currency,
              DerivType: "",
              DerivDetails: "",
              Volume: mutation.value,
              Price: "",
              Counter: currency === "XRP" ? "JPY" : "XRP",
              Fee: isFee === 1 ? fee : 0,
              FeeCcy: isFee === 1 ? "XRP" : "XRP",
              Comment: tx.TransactionType + " / " + tx.hash,
              TransactionType: tx.TransactionType,
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

const formatDate = (d) => {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}` //.padStart(2, "0")
  .replace(/\n|\r/g, "");
};


const fields = [
  "Timestamp",
  "Action",
  "Source",
  "Base",
  "DerivType",
  "DerivDetails",
  "Volume",
  "Price",
  "Counter",
  "Fee",
  "FeeCcy",
  "Comment",
  "TransactionType",
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

module.exports = {
  app,
  fields,
  string2hex,
};
