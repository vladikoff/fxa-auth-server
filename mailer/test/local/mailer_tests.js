/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var extend = require('util')._extend

var sinon = require('sinon')
var P = require('bluebird')
var test = require('tap').test

var nullLog = {
  trace: function () {},
  info: function () {},
  error: function () {}
}

var config = require('../../config')
var Mailer = require('../../mailer')(nullLog)

var messageTypes = [
  'newDeviceLoginEmail',
  'passwordChangedEmail',
  'passwordResetEmail',
  'passwordResetRequiredEmail',
  'postVerifyEmail',
  'recoveryEmail',
  'unblockCodeEmail',
  'verificationReminderEmail',
  'verifyEmail',
  'verifyLoginEmail'
]

var typesContainSupportLinks = [
  'newDeviceLoginEmail',
  'passwordChangedEmail',
  'passwordResetEmail',
  'postVerifyEmail',
  'recoveryEmail',
  'verificationReminderEmail',
  'verifyEmail'
]

var typesContainPasswordResetLinks = [
  'passwordChangedEmail',
  'passwordResetEmail',
  'passwordResetRequiredEmail',
]

var typesContainPasswordChangeLinks = [
  'newDeviceLoginEmail',
  'verifyLoginEmail'
]

var typesContainUnblockCode = [
  'unblockCodeEmail'
]

var typesContainReportSignInLinks = [
  'unblockCodeEmail'
]

var typesContainAndroidStoreLinks = [
  'postVerifyEmail'
]

var typesContainIOSStoreLinks = [
  'postVerifyEmail'
]

var typesContainLocationData = [
  'newDeviceLoginEmail',
  'passwordChangedEmail',
  'unblockCodeEmail',
  'recoveryEmail',
  'verifyEmail',
  'verifyLoginEmail'
]

var typesContainPasswordManagerInfoLinks = [
  'passwordResetRequiredEmail',
]

function includes(haystack, needle) {
  return (haystack.indexOf(needle) > -1)
}

function getLocationMessage (location) {
  return {
    device: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.11; rv:48.0) Gecko/20100101 Firefox/48.0',
    email: 'a@b.com',
    ip: '219.129.234.194',
    location: location,
    service: 'sync',
    timeZone: 'America/Los_Angeles'
  }
}

function sesMessageTagsHeaderValue(templateName) {
  return 'messageType=fxa-' + templateName + ', app=fxa'
}

P.all(
  [
    require('../../translator')(['en'], 'en'),
    require('../../templates')()
  ]
)
.spread(
  function (translator, templates) {

    messageTypes.forEach(
      function (type) {
        var mailer = new Mailer(translator, templates, config.get('mail'))

        var message = {
          code: 'abc123',
          email: 'a@b.com',
          locations: [],
          service: 'sync',
          uid: 'uid',
          unblockCode: 'AS6334PK',
          flowId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          flowBeginTime: Date.now()
        }

        test(
          'Contains template header for ' + type,
          function (t) {
            mailer.mailer.sendMail = function (emailConfig) {
              var templateName = emailConfig.headers['X-Template-Name']

              if (type === 'verificationReminderEmail') {
                // Handle special case for verification reminders
                t.equal(templateName, 'verificationReminderFirstEmail' || 'verificationReminderSecondEmail')
              } else if (type === 'verifyEmail') {
                // Handle special case for verify email
                t.equal(templateName, 'verifySyncEmail')
              } else {
                t.equal(templateName, type)
              }
              t.end()
            }
            mailer[type](message)
          }
        )

        test(
          'Contains flow headers for ' + type,
          function (t) {
            if (type !== 'verificationReminderEmail') {
              mailer.mailer.sendMail = function (emailConfig) {
                var flowIdHeader = emailConfig.headers['X-Flow-Id']
                t.equal(flowIdHeader, message.flowId)

                var flowBeginHeader = emailConfig.headers['X-Flow-Begin-Time']
                t.equal(flowBeginHeader, message.flowBeginTime)
              }
              mailer[type](message)
            }

            t.end()
          }
        )

        test(
          'test privacy link is in email template output for ' + type,
          function (t) {
            var privacyLink = mailer.createPrivacyLink(type)

            mailer.mailer.sendMail = function (emailConfig) {
              t.ok(includes(emailConfig.html, privacyLink))
              t.ok(includes(emailConfig.text, privacyLink))
              t.end()
            }
            mailer[type](message)
          }
        )

        test(
          'If sesConfigurationSet is not defined, then outgoing email does not contain X-SES* headers, for type ' + type,
          function (t) {
            mailer.mailer.sendMail = function (emailConfig) {
              var sesConfigurationSetHeader = emailConfig.headers['X-SES-CONFIGURATION-SET']
              t.ok(!sesConfigurationSetHeader)
              var sesMessageTags = emailConfig.headers['X-SES-MESSAGE-TAGS']
              t.ok(!sesMessageTags)
              t.end()
            }

            mailer[type](message) // invoke
          }
        )

        test(
          'If sesConfigurationSet is defined, then outgoing email will contain X-SES* headers, for type ' + type,
          function (t) {
            var savedSesConfigurationSet = mailer.sesConfigurationSet
            mailer.sesConfigurationSet = 'some-defined-value'

            mailer.mailer.sendMail = function (emailConfig) {
              var sesConfigurationSetHeader = emailConfig.headers['X-SES-CONFIGURATION-SET']
              t.equal(sesConfigurationSetHeader, 'some-defined-value')

              var sesMessageTags = emailConfig.headers['X-SES-MESSAGE-TAGS']
              var expectedSesMessageTags = sesMessageTagsHeaderValue(type)
              if (type === 'verificationReminderEmail') {
                expectedSesMessageTags = sesMessageTagsHeaderValue('verificationReminderFirstEmail')
                if (message.type === 'second') {
                  expectedSesMessageTags = sesMessageTagsHeaderValue('verificationReminderSecondEmail')
                }
              }
              t.equal(sesMessageTags, expectedSesMessageTags)

              mailer.sesConfigurationSet = savedSesConfigurationSet
              t.end()
            }

            mailer[type](message) // invoke
          }
        )

        if (includes(typesContainSupportLinks, type)) {
          test(
            'test support link is in email template output for ' + type,
            function (t) {
              var supportTextLink = mailer.createSupportLink(type)

              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, supportTextLink))
                t.ok(includes(emailConfig.text, supportTextLink))
                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainPasswordResetLinks, type)) {
          var resetPasswordLink = mailer.createPasswordResetLink(message.email, type)

          test(
            'reset password link is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, resetPasswordLink))
                t.ok(includes(emailConfig.text, resetPasswordLink))
                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainPasswordChangeLinks, type)) {
          var passwordChangeLink = mailer.createPasswordChangeLink(message.email, type)
          test(
            'password change link is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, passwordChangeLink))
                t.ok(includes(emailConfig.text, passwordChangeLink))
                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainUnblockCode, type)) {
          test(
            'unblock code is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, message.unblockCode))
                t.ok(includes(emailConfig.text, message.unblockCode))

                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainReportSignInLinks, type)) {
          test(
            'report sign-in link is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                var reportSignInLink =
                  mailer.createReportSignInLink(type, message)
                t.ok(includes(emailConfig.html, reportSignInLink))
                t.ok(includes(emailConfig.text, reportSignInLink))

                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainAndroidStoreLinks, type)) {
          var androidStoreLink = mailer.androidUrl

          test(
            'Android store link is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, androidStoreLink))
                // only the html email contains links to the store
                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainIOSStoreLinks, type)) {
          var iosStoreLink = mailer.iosUrl

          test(
            'IOS store link is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, iosStoreLink))
                // only the html email contains links to the store
                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainPasswordManagerInfoLinks, type)) {
          var passwordManagerInfoUrl = mailer._generateLinks(config.get('mail').passwordManagerInfoUrl, message.email, {}, type).passwordManagerInfoUrl

          test(
            'password manager info link is in email template output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, passwordManagerInfoUrl))
                t.ok(includes(emailConfig.text, passwordManagerInfoUrl))
                t.end()
              }
              mailer[type](message)
            }
          )
        }

        if (includes(typesContainLocationData, type)) {

          var defaultLocation = {
            city: 'Mountain View',
            country: 'USA',
            stateCode: 'CA'
          }

          test(
            'ip data is in template for ' + type,
            function (t) {
              var message = getLocationMessage(defaultLocation)

              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, message.ip))

                t.ok(includes(emailConfig.text, message.ip))
                t.end()
              }
              mailer[type](message)
            }
          )

          test(
            'location is correct with city, country, stateCode for ' + type,
            function (t) {
              var location = defaultLocation
              var message = getLocationMessage(defaultLocation)

              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, location.city + ', ' + location.stateCode + ', ' + location.country))
                t.ok(includes(emailConfig.text, location.city + ', ' + location.stateCode + ', ' + location.country))
                t.end()
              }
              mailer[type](message)
            }
          )

          test(
            'location is correct with city, country for ' + type,
            function (t) {
              var location = extend({}, defaultLocation)
              delete location.stateCode
              var message = getLocationMessage(location)


              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, location.city + ', ' + location.country))
                t.ok(includes(emailConfig.text, location.city + ', ' + location.country))
                t.end()
              }
              mailer[type](message)
            }
          )

          test(
            'location is correct with stateCode, country for ' + type,
            function (t) {
              var location = extend({}, defaultLocation)
              delete location.city
              var message = getLocationMessage(location)

              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, location.stateCode + ', ' + location.country))
                t.ok(includes(emailConfig.text, location.stateCode + ', ' + location.country))
                t.end()
              }
              mailer[type](message)
            }
          )

          test(
            'location is correct with country for ' + type,
            function (t) {
              var location = extend({}, defaultLocation)
              delete location.city
              delete location.stateCode
              var message = getLocationMessage(location)


              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, location.country))
                t.ok(includes(emailConfig.text, location.country))
                t.end()
              }
              mailer[type](message)
            }
          )

        }

        if (type === 'verifyLoginEmail') {
          test(
            'test verify token email',
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                var verifyLoginUrl = config.get('mail').verifyLoginUrl
                t.ok(emailConfig.html.indexOf(verifyLoginUrl) > 0)
                t.ok(emailConfig.text.indexOf(verifyLoginUrl) > 0)

                t.end()
              }
              mailer[type](message)
            }
          )
        } else if (type === 'postVerifyEmail') {
          test(
            'test utm params for ' + type,
            function (t) {
              var syncLink = mailer._generateUTMLink(config.get('mail').syncUrl, {}, type, 'connect-device')
              var androidLink = mailer._generateUTMLink(config.get('mail').androidUrl, {}, type, 'connect-android')
              var iosLink = mailer._generateUTMLink(config.get('mail').iosUrl, {}, type, 'connect-ios')

              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, syncLink))
                t.ok(includes(emailConfig.html, androidLink))
                t.ok(includes(emailConfig.html, iosLink))
                t.end()
              }
              mailer[type](message)
            }
          )
        } else if (type === 'verificationReminderEmail') {
          var reminderMessage = extend(message, {
            type: 'customType'
          })

          test(
            'custom reminder types are supported in output for ' + type,
            function (t) {
              mailer.mailer.sendMail = function (emailConfig) {
                t.ok(includes(emailConfig.html, 'reminder=customType'))
                t.ok(includes(emailConfig.text, 'reminder=customType'))
                t.end()
              }
              mailer[type](reminderMessage)
            }
          )
        }
      }
    )

    test(
      'test user-agent info rendering',
      function (t) {
        var mailer = new Mailer(translator, templates, config.get('mail'))

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: 'Firefox',
          uaBrowserVersion: '32',
          uaOS: 'Windows',
          uaOSVersion: '8.1'
        }), 'Firefox on Windows 8.1')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: 'Chrome',
          uaBrowserVersion: undefined,
          uaOS: 'Windows',
          uaOSVersion: '10',
        }), 'Chrome on Windows 10')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: undefined,
          uaBrowserVersion: '12',
          uaOS: 'Windows',
          uaOSVersion: '10'
        }), 'Windows 10')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: 'MSIE',
          uaBrowserVersion: '6',
          uaOS: 'Linux',
          uaOSVersion: '9'
        }), 'MSIE on Linux 9')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: 'MSIE',
          uaBrowserVersion: undefined,
          uaOS: 'Linux',
          uaOSVersion: undefined
        }), 'MSIE on Linux')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: 'MSIE',
          uaBrowserVersion: '8',
          uaOS: undefined,
          uaOSVersion: '4'
        }), 'MSIE')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: 'MSIE',
          uaBrowserVersion: undefined,
          uaOS: undefined,
          uaOSVersion: undefined
        }), 'MSIE')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: undefined,
          uaBrowserVersion: undefined,
          uaOS: 'Windows',
          uaOSVersion: undefined
        }), 'Windows')

        t.equal(mailer._formatUserAgentInfo({
          uaBrowser: undefined,
          uaBrowserVersion: undefined,
          uaOS: undefined,
          uaOSVersion: undefined
        }), '')

        t.end()
      }
    )

    test(
      'resolves sendMail status',
      function (t) {
        var mailer = new Mailer(translator, templates, config.get('mail'))
        sinon.stub(mailer.mailer, 'sendMail', function (config, cb) {
          cb(null, { resp: 'ok' })
        })

        var message = {
          email: 'test@restmail.net',
          subject: 'subject',
          template: 'verifyLoginEmail',
          uid: 'foo'
        }

        return mailer.send(message)
          .then(function (status) {
            t.equal(status.resp, 'ok')
            t.done()
          })
      }
    )

    test(
      'rejects sendMail status',
      function (t) {
        var mailer = new Mailer(translator, templates, config.get('mail'))
        sinon.stub(mailer.mailer, 'sendMail', function (config, cb) {
          cb(new Error('Fail'))
        })

        var message = {
          email: 'test@restmail.net',
          subject: 'subject',
          template: 'verifyLoginEmail',
          uid: 'foo'
        }

        return mailer.send(message)
          .then(t.notOk, function (err) {
            t.equal(err.message, 'Fail')
            t.done()
          })
      }
    )


  }
)
