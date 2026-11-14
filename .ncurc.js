import {localCooldown} from '@cto.af/ncurc';

export default {
  dep: ['prod', 'dev', 'packageManager'],
  cooldown: await localCooldown(),
};
