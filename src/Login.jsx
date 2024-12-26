import { useEffect, useState } from "react";
import Logo from "../logo.svg";
import LogoDark from "../logo-dark.svg";
import GitHubLogo from "../src/icons/github.svg";

export function Login({ setCredentials, errorMessage }) {
  const [region, setRegion] = useState(
    localStorage.getItem("s3-region") || "eu-central-1",
  );
  const [endpoint, setEndpoint] = useState(localStorage.getItem("s3-endpoint"));
  const [bucketName, setBucketName] = useState(
    localStorage.getItem("s3-bucket") || "philippnotes",
  );
  const [accessKeyId, setAccessKeyId] = useState(
    localStorage.getItem("s3-access-key") || "AKIAX56OJIIK6SXSQ5C5",
  );
  const [secretAccessKey, setSecretAccessKey] = useState(
    sessionStorage.getItem("s3-secret-access-key") || '',
  );

  const [showEndpoint, setShowEndpoint] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [rememberSecret, setRememberSecret] = useState(false);

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (region && bucketName && accessKeyId && secretAccessKey) {
      if (rememberCredentials) {
        localStorage.setItem("s3-access-key", accessKeyId);
        localStorage.setItem("s3-bucket", bucketName);
        localStorage.setItem("s3-region", region);
        localStorage.setItem("s3-endpoint", endpoint);
        if (rememberSecret) {
          localStorage.setItem("s3-secret-access-key", secretAccessKey);
        } else {
          sessionStorage.setItem("s3-secret-access-key", secretAccessKey);
        }
      }
      console.debug("Setting credentials");
      setCredentials({
        region,
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
      });
    }
  }

  useEffect(() => {
    console.log('here!');
  })

  return (
    <>
      <div className="login">
        <div className="headline">
          <picture>
            <source srcset={LogoDark} media="(prefers-color-scheme: dark)" />
            <img
              src={Logo}
              className="icon"
              alt="Bucketnotes"
              title="Bucketnotes"
            ></img>
          </picture>
        </div>
        {errorMessage && <div className="error">{errorMessage}</div>}
        <form onSubmit={handleSubmit}>
          <div className="half-width">
            <div className="input">
              <label>Region</label>
              <input
                type="text"
                id="s3-region"
                autoCapitalize="off"
                placeholder="e.g. eu-central-1"
                value={region}
                required={true}
                onChange={(ev) => setRegion(ev.target.value)}
              />
            </div>

            <div className="input">
              <label>Bucketname</label>
              <input
                type="text"
                id="s3-bucket"
                autoCapitalize="off"
                placeholder="mys3bucket"
                autoFocus={true}
                required={true}
                value={bucketName}
                onChange={(ev) => setBucketName(ev.target.value)}
              />
            </div>
          </div>
          <div className="input">
            <label>Access Key ID</label>
            <input
              type="text"
              id="s3-access-key"
              autoCapitalize="off"
              placeholder="AKIAXXXXXXXX…"
              autoComplete="username"
              required={true}
              value={accessKeyId}
              onChange={(ev) => setAccessKeyId(ev.target.value)}
            />
          </div>
          <div className="input">
            <label>Secret Key</label>
            <input
              type="password"
              id="s3-secret-access-key"
              required={true}
              autoComplete="password"
              value={secretAccessKey}
              onChange={(ev) => setSecretAccessKey(ev.target.value)}
            />
          </div>
          <div
            className={[
              "endpoint",
              showEndpoint ? "show-endpoint" : "hide-endpoint",
            ].join(" ")}
          >
            <div
              className="message"
              onClick={(ev) => setShowEndpoint(!showEndpoint)}
            >
              I need to set a different endpoint than aws/amazon
            </div>
            <div className="input">
              <input
                type="text"
                id="s3-endpoint"
                placeholder="https://my-s3-service…"
              />
              <label htmlFor="s3-endpoint">Endpoint</label>
            </div>
          </div>

          <div className="half-width">
            <div>
              <div>
                <input
                  type="checkbox"
                  id="remember-credentials-except-secret"
                  defaultChecked={rememberCredentials}
                  onChange={(ev) => setRememberCredentials(ev.target.checked)}
                ></input>
                <label htmlFor="remember-credentials-except-secret">
                  Remember credentials
                </label>
              </div>
              {rememberCredentials ? (
                <div>
                  <input
                    type="checkbox"
                    id="remember-secret"
                    defaultChecked={rememberSecret}
                    onChange={(ev) => {
                      if (ev.target.checked) {
                        if (
                          confirm(
                            "Secret will be stored unencrypted in the local-storage of your browser.\nAre you sure?",
                          )
                        ) {
                          return setRememberSecret(true);
                        }
                        ev.target.checked = false;
                        ev.preventDefault();
                        return;
                      }
                      setRememberSecret(ev.target.checked);
                    }}
                  ></input>
                  <label htmlFor="remember-secret">Remember secret</label>
                </div>
              ) : (
                <div>&nbsp;</div>
              )}
            </div>
            <button type="submit">Login</button>
          </div>
        </form>
      </div>
      <div className="copyright-badge">
        <a
          href="https://github.com/pstaender/bucketnotes"
          target="_blank"
          className="icon"
        >
          <img src={GitHubLogo} className="icon" alt="GitHub"></img>
        </a>
        bucketnotes is crafted with ❤️ by&nbsp;
        <a href="https://github.com/pstaender">pstaender</a>
      </div>
    </>
  );
}
