# webrunner
WebRunner is a development tool for web applications that acts as a plugin-ready proxy. It sits between the browser and a web application. Requests can be passed through to the origin server or be served from local files.

# Install

On Mac and Linux: sudo npm install webrunner -g

On Windows: npm install webrunner -g

# Configure

In your home folder, create a sub-folder named .webrunner. In the web runner folder create a file named configure.json.

Sample config file:

{
  "profiles": [
    {
      "name": "scottcote",
      "host": "www.scottcote.com",
      "secureHost": true,
      "plugins": [
        {
          "enabled": true,
          "matchType": "urlPathname",
          "matchValue": "/cacheable/script.js",
          "type": "replaceBodyWithFile",
          "config": {
            "filePath": "/Users/scottcote/Downloads/script.js"
          }
        }
      ]
    },
    {
      "name": "yahoo",
      "host": "www.yahoo.com",
      "secureHost": true
    }
  ]
}
