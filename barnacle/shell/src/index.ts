#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .command('init', 'Initialize Barnacle configuration', (yargs) => {
    return yargs;
  }, async (argv) => {
    console.log('🦞 Initializing Barnacle...');
    // TODO: Implementar
  })
  .command('config', 'Configure freemium settings', (yargs) => {
    return yargs
      .option('price', {
        describe: 'Monthly price in USD',
        type: 'number',
      })
      .option('trial-days', {
        describe: 'Free trial days',
        type: 'number',
        default: 14,
      })
      .option('image', {
        describe: 'Docker image name',
        type: 'string',
      });
  }, async (argv) => {
    console.log('🦞 Configuring:', {
      price: argv.price,
      trialDays: argv['trial-days'],
      image: argv.image,
    });
    // TODO: Implementar
  })
  .command('publish', 'Publish image with Barnacle', (yargs) => {
    return yargs.option('image', {
      describe: 'Docker image to publish',
      type: 'string',
      required: true,
    });
  }, async (argv) => {
    console.log('🦞 Publishing:', argv.image);
    // TODO: Implementar
  })
  .demandCommand()
  .strict()
  .parse();
