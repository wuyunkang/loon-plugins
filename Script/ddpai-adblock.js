/*
 * 盯盯拍去广告，供 Loon http-response 使用。
 * 根据用户提供的 2026-11-14 抓包，仅修改已确认的广告字段。
 * 不打印请求、响应、账号或设备信息；异常及未知结构原样放行。
 */
(function () {
  var result = {};
  try {
    if (typeof $request === 'undefined' || typeof $response === 'undefined') {
      $done(result);
      return;
    }

    // 不依赖浏览器 URL API，兼容 Loon 的 JavaScript 运行环境。
    var match = /^https?:\/\/(?:app|appgw)\.ddpai\.com(?::\d+)?(\/[^?#]*)(?:\?[^#]*)?$/i.exec($request.url || '');
    var status = Number($response.status);
    if (!match || status < 200 || status >= 300 || !isFinite(status) ||
        typeof $response.body !== 'string' || !$response.body) {
      $done(result);
      return;
    }

    var path = match[1];
    var isAd = path === '/onroad/api/v1/ad/list';
    var isBanner = path === '/onroad/api/v2/banner/list' || path === '/market/api/v1/banner/list';
    var isActivity = path === '/onroad/api/v1/activity/list' || path === '/onroad/api/v2/activity/list';
    if (isAd || isBanner || isActivity) {
      var data = JSON.parse($response.body);
      if (data && data.error_code === 0) {
        var info = data.error_info;
        var changed = false;
        if (isAd && info && Array.isArray(info.thirdAds) && info.thirdAds.length) {
          info.thirdAds = [];
          changed = true;
        } else if (isBanner && Array.isArray(info) && info.length) {
          data.error_info = [];
          changed = true;
        } else if (isActivity && Array.isArray(info)) {
          // 活动接口同时包含产品支持、应急服务，仅过滤抓包中确认的延保推广。
          var kept = info.filter(function (item) {
            return !(item && typeof item.adLink === 'string' &&
              /^https?:\/\/cdn\.static\.ddpai\.com\/h5\/market\/warranty\//i.test(item.adLink));
          });
          if (kept.length !== info.length) {
            data.error_info = kept;
            changed = true;
          }
        }
        if (changed) result = { body: JSON.stringify(data) };
      }
    }
  } catch (_) {
    // 解析失败时沿用服务器响应，避免影响设备及账号业务。
  }
  $done(result);
}());

