let mongoose = require('mongoose');
let Url = require("../models/url");
let Account = require("../models/account");
const config = require("../config/app");

module.exports.remainingUrlsPerCif = function remainingUrlsPerCif(callback) {
  //API quota resets by Pacific Time, offset UTC date by 8 hours, add 1 second drift
  var dateFrom = new Date(Date.now() - 1000 * 3600 * 8 - 1000);
  dateFrom.setUTCHours(8,0,1,0);

  Account.distinct("cif", function(err, all_cifs) {
    if(err) {
      callback(err, null);
      return;
    }

    Url.aggregate([
      {$match: {'notifytime' : { $gt : dateFrom}, 'status': 'updated'}},
      {"$group" : {_id:"$cif_used", count:{$sum:1}}}
    ], function(err, cif_count) {
      if(err) {
        callback(err, null);
        return;
      }

      const result = {};
      for(const cif of all_cifs) {
        result[cif] = config.api_daily_quota;
      }

      for(const row of cif_count) {
        result[row._id] = config.api_daily_quota - row.count;
      }

      callback(null, result);
    });
  });


};
