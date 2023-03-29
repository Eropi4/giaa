let mongoose = require('mongoose');
let Url = require("../models/url");

module.exports.remainingUrls = function remainingUrls(callback) {
  //API quota resets by Pacific Time, offset UTC date by 8 hours, add 1 second drift
  var dateFrom = new Date(Date.now() - 1000 * 3600 * 8 - 1000);
  dateFrom.setUTCHours(8,0,1,0);
  Url.countDocuments({'notifytime' : { $gt : dateFrom}, 'status': 'updated'}, function( err, count){
    if (err) {
      callback(err, null);
    } else {
      callback(null, count);
    }
  });
};
