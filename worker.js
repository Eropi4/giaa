let mongoose = require('mongoose');
let config = require('./config/app.js');
let Url = require("./models/url");
let Account = require("./models/account");
let indexer = require('./modules/indexer');
let utils = require('./modules/utils');
mongoose.connect(config.database, {useNewUrlParser: true});
let CronJob = require('cron').CronJob;
let io = require('socket.io-client');
var parse = require('url-parse');
mongoose.set('useCreateIndex', true);

console.log('Starting indexer service...');
new CronJob(config.cron, function() {



  utils.remainingUrlsPerCif(function(err, cifQuota) {
    if(err){
      console.log(err);
      return;
    }

    var totalQuota = 0;
    Object.keys(cifQuota).forEach(key => {
      totalQuota += Number(cifQuota[key])
    });

    console.log('[WORKER] Processing urls with total quota ' + totalQuota);

    if(totalQuota > 0){
      var urls = Url.find({ 'status': 'pending' }).limit(totalQuota);
      urls.exec(function (err, urls) {
        if (err) {
          console.log(err);
          return;
        }
        urls.forEach(function(url, index, arr){
          console.log('Processing url: ' + url.location);
          var purl = parse(url.location, true);
          try{
            account = Account.findOne({ domain: {$regex: purl.hostname , $options: 'ig'} }).exec(function (err, account) {
              if(err || !account) {
                console.log(err)
                return;
              }

              if(cifQuota[account.cif] === undefined) {
                console.log("No quota counter for " + account.cif);
                return;
              }

              if(cifQuota[account.cif] < 1) {
                console.log('Exceeding daily quota for ' + account.cif);
                return;
              }

              cifQuota[account.cif]--;

              var initializeIndexer = indexer.notify(url.location, url.type, account.cif);
              initializeIndexer.then(function(urlDetails) {

                if(urlDetails.error){
                  url.response_status_code = urlDetails.error.code;
                  url.response_status_message = urlDetails.error.message;
                  url.notifytime = new Date();
                  url.status = 'error';
                  url.updatedat = new Date();
                }else{
                  url.response_status_code = '200';
                  if(url.type == 'URL_DELETED'){
                    url.response_status_message = urlDetails.urlNotificationMetadata.latestRemove.type;
                    url.notifytime = urlDetails.urlNotificationMetadata.latestRemove.notifyTime;
                  }else{
                    url.response_status_message = urlDetails.urlNotificationMetadata.latestUpdate.type;
                    url.notifytime = urlDetails.urlNotificationMetadata.latestUpdate.notifyTime;
                  }
                  url.status = 'updated';
                  url.updatedat = new Date();
                }

                url.cif_used = account.cif

                url.save(function (err) {
                  if (err) return handleError(err);
                  var client = io.connect( "http://localhost:3000");
                  client.once("connect", function () {
                    client.emit('updatedUrl', url, function(){
                      client.disconnect();
                    });
                  });
                });

              }, function(err) {
                console.log('GSC record not found');
              });

            });
          }catch(error){
            console.log(error)
          }
        });
      });
    }else{
      console.log('Exceeding total daily quota!');
    }

  });

}, null, true, 'Europe/Rome');
