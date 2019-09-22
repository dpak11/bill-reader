/*jshint esversion: 6*/

const express = require("express");
const app = express();
const bodyParser = require('body-parser');
//const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Tesseract = require("tesseract.js");
const { TesseractWorker } = Tesseract;


const http = require('http').Server(app);
const port = process.env.PORT || 3000;


app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json({ limit: '5mb' })); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";





let transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: false,
    auth: {
        user: "app.readerbills@gmail.com",
        pass: ""
    }
});


function sendActivationMail(code) {

    let mailOptions = {
        from: "app.readerbills@gmail.com",
        to: "xxx@yyy.com",
        subject: "Your Activation Code:",
        html: `<h2>Hello!</h2>
        <p>Thank You for your interest in trying out Bill Reader</p>
        <p>Your activation code is: <b>${code}</b></p> `
    }

    transporter.sendMail(mailOptions, function(err, data) {
        if (err) {
            console.log("Node Mailer Error: \n" + err)
        } else {
            console.log("Email delivered")
        }
    });
}
//sendActivationMail("234");



app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");

});

app.post("/processimage", (req, res) => {
    console.log("Image processing...");
    //console.log(req.body.myimg);
    scanBill(req.body.img).then(function(data) {
        console.log(data);
        res.json({ status: data });
    }).catch(function(err) {        
        res.json({ status: err });
    });

});


function generateEmailConstantKey(email){
    let constantkey = "2UoH8OIQlxWJzAVcu9T6smLNXpFqZSR1tyD+g4bnwCfhkd=GKv7BMeaYirEjP503";
    let encodedEmail = Buffer.from(email).toString('base64');
    console.log(encodedEmail);
    const len = encodedEmail.length;
    const max = constantkey.length-1;  
    let str = ``;
    for(let i=0; i<len;i++){
        let index = constantkey.indexOf(encodedEmail.substr(i,1)) + email.length;
        index = index >= max ? index-max : index;
        str = `${str}${constantkey.substr(index,1)}`;
    }   
    console.log(str);
    return Buffer.from(str).toString('base64')
}
console.log(generateEmailConstantKey("gopinath@gmail.com"));


function scanBill(img) {
    const worker = new TesseractWorker();
    return worker.recognize(img)
        .progress((p) => {
            //console.log('progress', p);
        })
        .then(({ text }) => {
            console.log(text);
            let receiptTitle = sanitiser(text.split("\n")[0], false);            
            let arr = text.toLowerCase().split("\n");
            let dateStr = dateSearch(arr);
            arr = arr.filter(function(txt) {
                return (txt.includes("total") || txt.includes("amount") || txt.includes("amnt") || txt.includes("payable"));
            });

            
            worker.terminate();
            return new Promise((resolve, reject) => {
                if (arr.length > 0) {
                    let get_total = sanitiser(extractTotalVal(arr), true);
                    resolve({title:receiptTitle, total:get_total, date: dateStr});
                } else {
                    reject("No Total Found")
                }

            });

        });
    
}

function dateSearch(lines){
    let pattern1 = new RegExp("([0-9]){1,2}/([0-9]){1,2}/([0-9]){2,4}");
    let pattern2 = new RegExp("([0-9]){1,2}-([0-9]){1,2}-([0-9]){2,4}");
    let dates = [];
    //console.log("date>>>>"+lines.length);
    let monthCheck={
        vals: function(v){
            if(v[2].length == 2 || v[2].length == 4){
                if(Number(v[1])>12){
                    let formattedMonth = `${v[1]}/${v[0]}/${v[2]}`;
                    return formattedMonth;
                }else{
                   return v.join("/"); 
               }                
            }
            return false;  
        }
    };

    lines.forEach(function(line){
        
        let l1 = line.match(pattern1);
        let l2 = line.match(pattern2);
        if(l1 !=null && l1.length > 1){
            let m1 = monthCheck.vals(l1[0].split("/"));
            if(m1){dates.push(m1)}                      
        }
        if(l2 !=null && l2.length > 1){
            let m2 = monthCheck.vals(l2[0].split("/"));
            if(m2){dates.push(m2)}           
        }        
    })
    return dates[0]
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
                total.indexOf("amnt") >= 0 ? total.split("amnt")[1] :
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
    console.log("################# \n"+str);
    for (let i = 0; i < str.length; i++) {
        let txt = str.substr(i, 1);
        if (chars.indexOf(txt) >= 0) {
            newchar = newchar + txt;
        }
    }
    return newchar;
}

//console.log(Buffer.from("lop@yahoo.com").toString('base64'));
//console.log(Buffer.from("am9zZXBoQHlhaG9vLmNvbQ==","base64").toString('ascii'));


// pattern = new RegExp(char,"g")
// ("this is some text").replace(pattern,"0")

http.listen(port, () => {
    console.log(`Server running at port ` + port);
});

