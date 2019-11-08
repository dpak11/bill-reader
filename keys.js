

if(process.env.MONGO_URL && process.env.APP_MAILER_PSWD){
	module.exports = {mongodb: process.env.MONGO_URL, mailerPswd:process.env.APP_MAILER_PSWD, email:process.env.APP_MAILER_EMAIL, servConstantKey:process.env.SERV_CONST_KEY, notificationBox:process.env.NOFEATURE_NOTIFY}
}else{	
	module.exports = require("./dev");
}