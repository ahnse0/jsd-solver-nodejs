const tlsFetch = require("./TLSClient");

const _headers = {};

async function clientFetch(url, init = {}) {
  const { body = "", method = "GET", headers = {}, log = false, followRedirect = true } = init;
  let currentUrl = url;
  if(log) console.log(colors.Green + "Loading:" + colors.Reset, colors.Gray + currentUrl + colors.Reset);

  while (true) {
    const fullHeaders = Object.assign({}, _headers, headers);
    const response = await tlsFetch(currentUrl, { headers: fullHeaders, body, method,});

    const location = response.headers["Location"]?.[0] || response.headers["location"] || response.headers.get?.("location");

    if (!followRedirect || !location) return response;
    if (log) console.log(colors.Yellow + "Redirecting:" + colors.Reset, colors.Gray + location + colors.Reset);
    currentUrl = new URL(location, currentUrl).href;
  }
}


module.exports = {
    _headers,
    clientFetch
}