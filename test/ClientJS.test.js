const fs = require('fs')
const path = require('path')
const { JSDOM } = require("jsdom")
var ClientJS

const sidebarHTML = '../Sidebar.html'
const clientJSHTML = '../ClientJS.html'
const clientJSFilename = '../ClientJS.js'
const mockFormHTML = './MockForm.html'

const notRunning = "LibLookup Desktop app is not running."
const firstEmptyColumnLetter = "C"
const firstEmptyColumnNumber = 3
const maxRowNumber = 1234

describe('Inline HTML JavaScript Test', () => {

  let fetchMock;
  let mockForm;
  let dom;

  beforeAll(() => {
    const clientJStext = fs.readFileSync(path.resolve(__dirname, clientJSHTML), 'utf8');
    var script = clientJStext.replace(/^<script>/,"").replace(/<\/script>$/,"");
    script = script.replace(/^\s*runLibLookup.*/,"\n")
    const functions = clientJStext.match(/function [^(]+/g).map(f => f.replace(/^function /,""))
    script += "\nmodule.exports = {" + functions.join(',') + "}"
    fs.writeFileSync(path.resolve(__dirname,clientJSFilename),script,'utf8');
    ClientJS = require("../ClientJS.js")
  })

  beforeEach(() => {    
    const sidebar = fs.readFileSync(path.resolve(__dirname, sidebarHTML ), 'utf8');  
    mockForm = fs.readFileSync(path.resolve(__dirname, mockFormHTML ), 'utf8');    
    dom = new JSDOM(sidebar)
    global.window = dom.window
    global.document = window.document
    fetchMock = jest.fn()
    global.fetch = fetchMock
    global.google = {
      script: {
        run: {
          withSuccessHandler: function(callback) {
            this._successHandler = callback;
            return this; 
          },
          getFirstEmptyColumn: function() {
            this._successHandler(firstEmptyColumnLetter)
          },
          getMaxUsedRow: function() {
            this._successHandler(maxRowNumber)
          }
        }
      }
    }
  })

  afterEach(() => {
    delete global.window;
    delete global.document;
    jest.restoreAllMocks();
  });

  test('Simulate LibLookup Desktop App not running', async () => {  
    fetchMock.mockRejectedValue(new Error("Test LibLookup Not Running")); 
    await ClientJS.runLibLookup(document)
    expect(document.querySelector("#content").innerHTML).toBe(notRunning)
  });

  test('Successfully load form, update elements', async () => {
    const addListenerSpy = jest.spyOn(window, 'addEventListener');
    fetchMock.mockResolvedValue({
      text: async () => mockForm
    }); 
    await ClientJS.runLibLookup(document)
    expect(document.querySelector('#content').firstElementChild.id).toBe("queryForm")
    const colLetter = document.querySelector('#resultColumn').value
    const colNumber = ClientJS.columnLetterToNumber(colLetter)
    expect(colLetter).toBe(firstEmptyColumnLetter)
    expect(colNumber).toBe(firstEmptyColumnNumber)

    ClientJS.updateStatus(document,"Test")
    expect(document.querySelector('#status').innerHTML).toBe("Test")
    
    document.querySelector('#startrow').value = String(999)
    document.querySelector('#allRowsButton').dispatchEvent(new window.Event('click'))
    expect(document.querySelector('#startrow').value).toBe(String(1))
    expect(document.querySelector('#endrow').value).toBe(String(maxRowNumber))

  })
});
