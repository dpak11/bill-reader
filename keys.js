

if(process.env.MONGO_URL && process.env.APP_MAILER_PSWD){
	module.exports = {mongodb: process.env.MONGO_URL,mailerPswd:process.env.APP_MAILER_PSWD,email:APP_MAILER_email}
}else{	
	module.exports = require("./dev");
}