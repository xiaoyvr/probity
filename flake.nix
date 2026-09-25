{
  description = "Probity development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];

            shellHook = ''
              if [ ! -d node_modules/.bin ]; then
                echo "probity: dependencies not installed, run 'npm ci'" >&2
              fi
            '';
          };
        }
      );
    };
}
