const fs = require('fs')
const path = require('path')
const { JSDOM } = require("jsdom")
const vm = require("vm");

const sidebarHTML = '../Sidebar.html'
const clientJSHTML = '../ClientJS.html'

const notRunning = "LibLookup Desktop app is not running."

describe('Inline HTML JavaScript Test', () => {

  let fetchMock;
  let dom;
  let script;

  beforeEach(() => {    
    const sidebar = fs.readFileSync(path.resolve(__dirname, sidebarHTML ), 'utf8');    
    const clientJS = fs.readFileSync(path.resolve(__dirname, clientJSHTML), 'utf8');
    dom = new JSDOM(sidebar, {runScripts: 'dangerously'})
    script = clientJS.replace(/^<script>/,"").replace(/<\/script>$/,"")
    fetchMock = jest.fn()
    global.window = dom.window
    global.window.fetch = fetchMock
    global.document = window.document

  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    jest.restoreAllMocks();
  });

  test('Simulate LibLookup Desktop App not running', async () => {  
    fetchMock.mockRejectedValue(); 
    const context = vm.createContext(window)
    const module = new vm.SourceTextModule(script, { context });
    await module.link(() => {});
    await module.evaluate()
    expect(document.querySelector("#content").innerHTML).toBe(notRunning)
  });
});
