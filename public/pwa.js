if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('service worker registered'))
    .catch(err => console.log('service worker not registered', err));
}else{
	alert("Your browser does not support some feature.\nPlease upgrade to the latest Google Chrome or Firefox browser")
}