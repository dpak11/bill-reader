if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('service worker registered'))
    .catch(err => console.log('service worker not registered', err));
}else{
	alert("Your browser does not support some features.\nThis is either because you are not on the latest version of Google Chrome/Firefox.\nOr you are currently in Incognito/Private Mode")
}