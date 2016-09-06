# webrunner
WebRunner is an extensible proxy server designed to make debugging, testing, and code exploration easier for full stack web developers. As a proxy, it is given HTTP traffic intended for another server and can manipulate the requests and responses as needed. WebRunner’s default behavior is to pass all traffic between the client and origin server with as little change as possible. A user controlled configuration file is used to specify a collection of plugins that are used to manipulate or log the traffic in any way that is helpful for debugging or testing. WebRunner comes with a set of stock Javascript plugins and users can create their own for specific use cases.


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
