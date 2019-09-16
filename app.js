/*jshint esversion: 6*/

const express = require("express");
const app = express();
const bodyParser = require('body-parser');


const http = require('http').Server(app);
const port = process.env.PORT || 3000;


app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json({ limit: '5mb' })); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));




const Tesseract = require("tesseract.js");

const { TesseractWorker } = Tesseract;

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");

});

app.post("/processimage", (req, res) => {
    console.log("Image processing...");
    console.log(req.body.myimg);
    res.json({ status: "test without image success" });

   /* scanBill(req.body.myimg).then(function(data) {
        //console.log(data);
        res.json({ status: data });
    }).catch(function(err) {
        //console.log(err);
        res.json({ status: err });
    });*/

});



function scanBill(img) {    
    const worker = new TesseractWorker();
    return worker.recognize(img)
        .progress((p) => {
            //console.log('progress', p);
        })
        .then(({ text }) => {
           // console.log(text);
            let receiptTitle = sanitiser(text.split("\n")[0], false);
            let arr = text.toLowerCase().split("\n");
            arr = arr.filter(function(txt) {
                return (txt.includes("total") || txt.includes("amount") || txt.includes("payable"));
            });

           // console.log("---------------------------------------------------------");
            worker.terminate();
            return new Promise((resolve, reject) => {
                if (arr.length > 0) {
                    let get_total = sanitiser(extractTotalVal(arr), true);
                    resolve(receiptTitle + "  " + get_total)
                } else {
                    reject("No Total Found")
                }

            });

        });
    // counter++;
    //scanBill();
}



function extractTotalVal(totals) {
    let totalValue = "";
    let subs = "";
    totals.forEach(function(_total) {
        if (totalValue == "") {
            let total = _total.trim();
            subs = total.indexOf("subtotal") >= 0 ? total.split("subtotal")[1] :
                total.indexOf("sub total") >= 0 ? total.split("sub total")[1] : "";
            totalValue = total.indexOf("amount payable") >= 0 ? total.split("amount payable")[1] :
                total.indexOf("payable amount") == 0 ? total.split("payable amount")[1] :
                total.indexOf("total amount") >= 0 ? total.split("total amount")[1] :
                total.indexOf("payable") >= 0 ? total.split("payable")[1] :
                total.indexOf("amount") >= 0 ? total.split("amount")[1] :
                (subs == "" && total.indexOf("total") >= 0) ? total.split("total")[1] : "";
        }
    });
    if (totalValue == "") {
        return subs;
    }
    return totalValue;
}

function sanitiser(str, isNumber) {
    let chars = isNumber ? "0123456789." : "0123456789qwertyuioplkjhgfdsazxcvbnm &QWERTYUIOPLKJHGFDSAZXCVBNM-";
    let newchar = "";
    for (let i = 0; i < str.length; i++) {
        let txt = str.substr(i, 1);
        if (chars.indexOf(txt) >= 0) {
            newchar = newchar + txt;
        }
    }
    return newchar;
}



http.listen(port, () => {
    console.log(`Server running at port ` + port);
});