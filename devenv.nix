{ pkgs, lib, config, inputs, ... }:

{  packages = [ pkgs.git ];
  
  languages.javascript = {
    enable = true;
    pnpm.enable = true;
    package = pkgs.nodejs_24;
  };
}
