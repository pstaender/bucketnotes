import { useEffect, useState } from "react";
import Logo from "../logo.svg";
import GitHubLogo from "../src/icons/github.svg";

export function Login({ setCredentials, errorMessage }) {
  const [loginCredentials, setLogiCredentials] = useState({
    region: localStorage.getItem("s3-region") || undefined,
    endpoint: localStorage.getItem("s3-endpoint") || undefined,
    bucketName: localStorage.getItem("s3-bucket") || undefined,
    accessKeyId: localStorage.getItem("s3-access-key") || undefined,
    secretAccessKey:
      sessionStorage.getItem("s3-secret-access-key") || undefined,
  });
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [rememberSecret, setRememberSecret] = useState(false);

  function handleChange(ev) {
    if (!ev.target.value?.trim()) {
      return;
    }

    switch (ev.target.id) {
      case "s3-region":
        setLogiCredentials({
          ...loginCredentials,
          ...{ region: ev.target.value },
        });
        break;
      case "s3-bucket":
        setLogiCredentials({
          ...loginCredentials,
          ...{ bucketName: ev.target.value },
        });
        break;
      case "s3-access-key":
        setLogiCredentials({
          ...loginCredentials,
          ...{ accessKeyId: ev.target.value },
        });
        break;
      case "s3-secret-access-key":
        setLogiCredentials({
          ...loginCredentials,
          ...{ secretAccessKey: ev.target.value },
        });
        break;
      case "s3-endpoint":
        setLogiCredentials({
          ...loginCredentials,
          ...{ endpoint: ev.target.value },
        });
        break;
      default:
        break;
    }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (
      loginCredentials.region &&
      loginCredentials.bucketName &&
      loginCredentials.accessKeyId &&
      loginCredentials.secretAccessKey
    ) {
      if (rememberCredentials) {
        localStorage.setItem("s3-access-key", loginCredentials.accessKeyId);
        localStorage.setItem("s3-bucket", loginCredentials.bucketName);
        localStorage.setItem("s3-region", loginCredentials.region);
        localStorage.setItem("s3-endpoint", loginCredentials.endpoint);
        if (rememberSecret) {
          localStorage.setItem(
            "s3-secret-access-key",
            loginCredentials.secretAccessKey,
          );
        } else {
          sessionStorage.setItem(
            "s3-secret-access-key",
            loginCredentials.secretAccessKey,
          );
        }
      }
      console.debug("Setting credentials");
      setCredentials(loginCredentials);
    }
  }

  return (
    <>
      <div className="login">
        <div className="headline">
          <img
            src={Logo}
            className="icon"
            alt="Bucketnotes"
            title="Bucketnotes"
          ></img>
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
                defaultValue={localStorage.getItem("s3-region")}
                autoFocus={!localStorage.getItem("s3-region")}
                required={true}
                onChange={handleChange}
              />
            </div>

            {/* <input type="text" id="s3-url" placeholder="Endpoint" /> */}
            <div className="input">
              <label>Bucketname</label>
              <input
                type="text"
                id="s3-bucket"
                autoCapitalize="off"
                defaultValue={localStorage.getItem("s3-bucket")}
                required={true}
                onChange={handleChange}
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
              defaultValue={localStorage.getItem("s3-access-key")}
              required={true}
              onChange={handleChange}
            />
          </div>
          <div className="input">
            <label>Secret Key</label>
            <input
              type="password"
              id="s3-secret-access-key"
              required={true}
              autoComplete="password"
              autoFocus={!!localStorage.getItem("s3-region")}
              onChange={handleChange}
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
          <img
            src={GitHubLogo}
            className="icon"
            alt="GitHub"
          ></img>
        </a>
        bucketnotes is crafted with ❤️ by&nbsp;
        <a href="https://github.com/pstaender">pstaender</a>
      </div>
    </>
  );
}
