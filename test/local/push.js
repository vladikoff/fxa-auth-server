/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const ROOT_DIR = '../..'

const assert = require('insist')
var proxyquire = require('proxyquire')
var sinon = require('sinon')
var ajv = require('ajv')()
var fs = require('fs')
var path = require('path')

const P = require(`${ROOT_DIR}/lib/promise`)
const mockLog = require('../mocks').mockLog
var mockUid = Buffer.from('foo')
var mockConfig = {}

const PUSH_PAYLOADS_SCHEMA_PATH = `${ROOT_DIR}/docs/pushpayloads.schema.json`
var TTL = '42'
const pushModulePath = `${ROOT_DIR}/lib/push`

var mockDbEmpty = {
  devices: function () {
    return P.resolve([])
  }
}

var mockDevices = [
  {
    'id': '0f7aa00356e5416e82b3bef7bc409eef',
    'isCurrentDevice': true,
    'lastAccessTime': 1449235471335,
    'name': 'My Phone',
    'type': 'mobile',
    'pushCallback': 'https://updates.push.services.mozilla.com/update/abcdef01234567890abcdefabcdef01234567890abcdef',
    'pushPublicKey': 'BCp93zru09_hab2Bg37LpTNG__Pw6eMPEP2hrQpwuytoj3h4chXpGc-3qqdKyqjuvAiEupsnOd_RLyc7erJHWgA=',
    'pushAuthKey': 'w3b14Zjc-Afj2SDOLOyong=='
  },
  {
    'id': '3a45e6d0dae543qqdKyqjuvAiEupsnOd',
    'isCurrentDevice': false,
    'lastAccessTime': 1417699471335,
    'name': 'My Desktop',
    'type': null,
    'pushCallback': 'https://updates.push.services.mozilla.com/update/d4c5b1e3f5791ef83896c27519979b93a45e6d0da34c75',
    'pushPublicKey': 'BCp93zru09_hab2Bg37LpTNG__Pw6eMPEP2hrQpwuytoj3h4chXpGc-3qqdKyqjuvAiEupsnOd_RLyc7erJHWgA=',
    'pushAuthKey': 'w3b14Zjc-Afj2SDOLOyong=='
  }
]

var mockDbResult = {
  devices: function (/* uid */) {
    return P.resolve(mockDevices)
  }
}

describe('push', () => {
  it(
    'notifyDeviceDisconnected calls pushToDevice',
    () => {
      var push = require(pushModulePath)(mockLog(), mockDbResult, mockConfig)
      sinon.spy(push, 'pushToDevice')
      var idToDisconnect = mockDevices[0].id
      var expectedData = {
        version: 1,
        command: 'fxaccounts:device_disconnected',
        data: {
          id: idToDisconnect
        }
      }
      return push.notifyDeviceDisconnected(mockUid, idToDisconnect)
    }
  )
})
