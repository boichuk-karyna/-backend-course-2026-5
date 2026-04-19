const { Command } = require('commander');
const { sayHello } = require('./main');

const program = new Command();

program
  .option('-n, --name <type>', 'your name');

program.parse(process.argv);

const options = program.opts();

sayHello(options.name);