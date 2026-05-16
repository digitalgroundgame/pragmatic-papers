{ pkgs, lib, config, inputs, ... }:

{  packages = [ pkgs.git ];
  
  dotenv.disableHint = true;

  languages.javascript = {
    enable = true;
    pnpm.enable = true;
    package = pkgs.nodejs_24;
  };
}
