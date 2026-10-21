const fs = require('fs')
const path = require('path')
const { JSDOM } = require("jsdom")
const vm = require("vm");
var ClientJS

const sidebarHTML = '../Sidebar.html'
const clientJSHTML = '../ClientJS.html'
const clientJSFilename = '../ClientJS.js'
const mockFormHTML = './MockForm.html'

const notRunning = "LibLookup Desktop app is not running."

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
    global.document = dom.window.document
    fetchMock = jest.fn()
    global.fetch = fetchMock
    global.google = {
      script: {
        run: {
          // Mock handlers to return 'this' to allow chaining
          withSuccessHandler: jest.fn().mockReturnThis(),
          withFailureHandler: jest.fn().mockReturnThis(),
          withUserObject: jest.fn().mockReturnThis(),
      
          // Mock your backend Apps Script functions here
          getFirstEmptyColumn: jest.fn(),
          getMaxUsedRow: jest.fn()
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
    fetchMock.mockRejectedValue(); 
    await ClientJS.runLibLookup(document)
    expect(document.querySelector("#content").innerHTML).toBe(notRunning)
  });

  test('Successfully load form', async () => {
    fetchMock.mockResolvedValue({
      text: async () => mockForm
    }); 
    await ClientJS.runLibLookup(document)
    expect(document.querySelector('#content').innerHTML.replaceAll(/\s/sg,"")).toBe(mockForm.replaceAll(/\s/sg,""))
    expect(ClientJS.columnLetterToNumber("A")).toBe(1)
  })
});
