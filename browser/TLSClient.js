/*
    chrome_103 chrome_104 chrome_105 chrome_106 chrome_107 chrome_108 chrome_109 chrome_110 chrome_111 chrome_112 chrome_116_PSK chrome_116_PSK_PQ chrome_117 chrome_120 chrome_124 chrome_130_PSK chrome_131 chrome_131_PSK chrome_133 chrome_133_PSK
    safari_15_6_1 safari_16_0 safari_ipad_15_6 safari_ios_15_5 safari_ios_15_6 safari_ios_16_0 safari_ios_17_0 safari_ios_18_0 safari_ios_18_5
    firefox_102 firefox_104 firefox_105 firefox_106 firefox_108 firefox_110 firefox_117 firefox_120 firefox_123 firefox_132 firefox_133 firefox_135
    opera_89 opera_90 opera_91
    zalando_android_mobile zalando_ios_mobile nike_ios_mobile nike_android_mobile cloudscraper
    mms_ios mms_ios_1 mms_ios_2 mms_ios_3 mesh_ios mesh_ios_1 mesh_ios_2
    mesh_android mesh_android_1 mesh_android_2 
    confirmed_ios confirmed_android 
    okhttp4_android_7 okhttp4_android_8 okhttp4_android_9 okhttp4_android_10 okhttp4_android_11 okhttp4_android_12 okhttp4_android_13
*/
//https://github.com/bogdanfinn/tls-client

//All of a sudden i get errors when installing ffi-napi
/*
the fix: 
download the prebuilt https://registry.npmjs.org/ffi-napi/-/ffi-napi-4.0.3.tgz

only files/folder necessary are:
lib/
prebuilds/
package.json

extract .tgz/packages to ./node_modules/ffi-napi
*/

const ffi = require("./ffi-napi");
const crypto = require("crypto");
const path = require("path");

const lib =
  process.platform === "win32" ? "tls-client-windows-64-1.12.1.dll" :
  process.platform === "darwin" ? `tls-client-darwin-${process.arch === "arm64" ? "arm64" : "amd64"}-1.12.1.dylib` : "tls-client-linux-ubuntu-amd64-1.11.2.so";


const tlsClientLibrary = ffi.Library(path.join(__dirname, lib), {
  request: ["string", ["string"]],
  getCookiesFromSession: ["string", ["string"]],
  addCookiesToSession: ["string", ["string"]],
  freeMemory: ["void", ["string"]],
  destroyAll: ["string", []],
  destroySession: ["string", ["string"]]
});

const session = crypto.randomUUID();

//https://tls.peet.ws/api/all
const customRequestPayload = {
  followRedirects: false,
  insecureSkipVerify: false,
  withoutCookieJar: false,
  withDefaultCookieJar: false,
  isByteRequest: false,
  catchPanics: false,
  forceHttp1: false,
  withDebug: false,
  withRandomTLSExtensionOrder: true,
  timeoutSeconds: 30,
  timeoutMilliseconds: 0,
  sessionId: session,
  certificatePinningHosts: {},
  customTlsClient: {
    ja3String: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,43-10-65037-18-45-35-65281-13-11-51-27-17613-5-0-16-23,4588-29-23-24,0",
    h2Settings: {
      HEADER_TABLE_SIZE: 65536,
      ENABLE_PUSH: 0,
      INITIAL_WINDOW_SIZE: 6291456,
      MAX_HEADER_LIST_SIZE: 262144
    },
    h2SettingsOrder: ["HEADER_TABLE_SIZE", "ENABLE_PUSH", "INITIAL_WINDOW_SIZE", "MAX_HEADER_LIST_SIZE"],
    supportedSignatureAlgorithms: ["ECDSAWithP256AndSHA256", "PSSWithSHA256", "PKCS1WithSHA256", "ECDSAWithP384AndSHA384", "PSSWithSHA384", "PKCS1WithSHA384", "PSSWithSHA512", "PKCS1WithSHA512"],
    supportedVersions: ["GREASE", "1.3", "1.2"],
    keyShareCurves: ["GREASE", "X25519MLKEM768", "X25519"],
    certCompressionAlgos: ["brotli"],
    alpnProtocols: ["h2", "http/1.1"],
    alpsProtocols: ["h2"],
    pseudoHeaderOrder: [":method", ":authority", ":scheme", ":path"],
    connectionFlow: 15663105,
    priorityFrames: [{
      streamID: 1,
      priorityParam: {
        streamDep: 1,
        exclusive: true,
        weight: 1
      }
    }],
    headerPriority: {
      streamDep: 1,
      exclusive: true,
      weight: 1
    }
  },
  proxyUrl: "",
  isRotatingProxy: false,
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-GB,en;q=0.9"
  },
  headerOrder: ["user-agent", "accept", "accept-encoding", "accept-language"],
  requestUrl: "",
  requestMethod: "",
  requestBody: "",
  requestCookies: []
};

async function tlsFetch(url, init){
    const { headers = {}, body = "", method = "GET", Request = {}} = init;
    let newRequest = Object.assign({}, customRequestPayload);
    newRequest = Object.assign(newRequest, Request);
    newRequest.headers = Object.assign(newRequest.headers, headers);
    newRequest.requestBody = body;
    newRequest.requestMethod = method;
    newRequest.requestUrl = url;

    const requestPromise = new Promise((resolve, reject) => {
        tlsClientLibrary.request.async(JSON.stringify(newRequest), (err, response) => {
            const responseObject = JSON.parse(response)
            resolve(responseObject)
        })
    });
    return await requestPromise;
}

module.exports = tlsFetch;