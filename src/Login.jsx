import { useEffect, useState } from "react";
import Logo from "../logo.svg";
import LogoDark from "../logo-dark.svg";
import GitHubLogo from "../src/icons/github.svg";
import * as encrypt from "./encrypt";
import { useNavigate } from "react-router-dom";

export function Login({ setCredentials, errorMessage, setErrorMessage }) {
  const [region, setRegion] = useState(
    sessionStorage.getItem("s3-region") || "",
  );
  const [endpoint, setEndpoint] = useState(
    sessionStorage.getItem("s3-endpoint") || "",
  );
  const [bucketName, setBucketName] = useState(null);
  const [accessKeyId, setAccessKeyId] = useState(
    sessionStorage.getItem("s3-access-key") || "",
  );
  const [secretAccessKey, setSecretAccessKey] = useState(
    sessionStorage.getItem("s3-secret-access-key") || "",
  );

  const [showEndpoint, setShowEndpoint] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (
      localStorage.getItem("s3-access-key") &&
      localStorage.getItem("s3-bucket") &&
      localStorage.getItem("s3-region") &&
      localStorage.getItem("s3-secret-access-key")
    ) {
      setShowPasswordLogin(true);
    }
  }, []);

  useEffect(() => {
    // only fill once (initial)
    if (bucketName !== null) {
      return;
    }
    (async () => {
      setEndpoint(
        (await encrypt.decryptLocalStorageItem(
          "s3-endpoint",
          localStorage,
          sessionStorage,
        )) || "",
      );
      setBucketName(
        (await encrypt.decryptLocalStorageItem(
          "s3-bucket",
          localStorage,
          sessionStorage,
        )) || "",
      );
      setAccessKeyId(
        (await encrypt.decryptLocalStorageItem(
          "s3-access-key",
          localStorage,
          sessionStorage,
        )) || "",
      );
      setSecretAccessKey(
        (await encrypt.decryptLocalStorageItem(
          "s3-secret-access-key",
          localStorage,
          sessionStorage,
        )) || "",
      );
      setRegion(
        (await encrypt.decryptLocalStorageItem(
          "s3-region",
          localStorage,
          sessionStorage,
        )) || "eu-central-1",
      );
    })();
  }, [bucketName]);

  useEffect(() => {
    setShowPasswordField(rememberLogin);
  }, [rememberLogin]);

  async function handlePasswordOnlySubmit(ev) {
    ev.preventDefault();
    if (await encrypt.validateTempPassword(tempPassword, localStorage)) {
      const data = JSON.parse(localStorage.getItem("tempPasswordEncrypted"));
      const randomTempPassword = await encrypt.decryptText(data, tempPassword);
      sessionStorage.setItem("tempPassword", randomTempPassword);
      return navigate(0);
    }
    setErrorMessage('Please check password or `Login with other S3 credentials`');
  }

  function handleClickOnRelogin() {
    navigate("/reset");
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (region && bucketName && accessKeyId && secretAccessKey) {
      /* we allow empty password to keep it easier (but unsafer) to use */
      if (rememberLogin) {
        console.debug("Setting credentials encrypted");
        await encrypt.setEncryptionPassword(
          tempPassword || '',
          localStorage,
          sessionStorage,
        );
        await encrypt.encryptLocalStorageItem(
          "s3-access-key",
          accessKeyId,
          localStorage,
          sessionStorage,
        );
        await encrypt.encryptLocalStorageItem(
          "s3-bucket",
          bucketName,
          localStorage,
          sessionStorage,
        );
        await encrypt.encryptLocalStorageItem(
          "s3-region",
          region,
          localStorage,
          sessionStorage,
        );
        await encrypt.encryptLocalStorageItem(
          "s3-endpoint",
          endpoint || "",
          localStorage,
          sessionStorage,
        );
        await encrypt.encryptLocalStorageItem(
          "s3-secret-access-key",
          secretAccessKey,
          localStorage,
          sessionStorage,
        );
      } else {
        localStorage.removeItem("s3-access-key");
        localStorage.removeItem("s3-bucket");
        localStorage.removeItem("s3-region");
        localStorage.removeItem("s3-endpoint");
        localStorage.removeItem("s3-secret-access-key");
      }
      sessionStorage.setItem("s3-access-key", accessKeyId);
      sessionStorage.setItem("s3-bucket", bucketName);
      sessionStorage.setItem("s3-region", region);
      sessionStorage.setItem("s3-endpoint", endpoint || "");
      sessionStorage.setItem("s3-secret-access-key", secretAccessKey);
      console.debug("Credentials are set");
      setCredentials({
        region,
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
      });
    }
  }

  return (
    <>
      <div className="login">
        <div className="headline">
          <picture>
            <source srcSet={LogoDark} media="(prefers-color-scheme: dark)" />
            <img
              src={Logo}
              className="icon"
              alt="Bucketnotes"
              title="Bucketnotes"
            ></img>
          </picture>
        </div>
        {errorMessage && <div className="error">{errorMessage}</div>}
        {showPasswordLogin ? (
          <form onSubmit={handlePasswordOnlySubmit}>
            <div className="input">
              <label>Password</label>
              <input
                type="password"
                id="password"
                required={true}
                autoComplete="password"
                autoFocus={true}
                onKeyDown={(ev) => setErrorMessage("")}
                onChange={(ev) => setTempPassword(ev.target.value)}
              />
            </div>

            <div>
              <div className="message" onClick={handleClickOnRelogin}>
                Login with other S3 credentials
              </div>
              <button type="submit">Login</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="half-width">
              <div className="input">
                <label>Region</label>
                <input
                  type="text"
                  id="s3-region"
                  autoCapitalize="off"
                  placeholder="e.g. eu-central-1"
                  value={region || ''}
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
                  value={bucketName || ''}
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
                value={accessKeyId || ''}
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
                value={secretAccessKey || ''}
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
            {showPasswordField && (
              <div className="input">
                <label>Lock Password (optional)</label>
                <input
                  type="password"
                  id="temp-password"
                  autoComplete="password"
                  autoFocus={true}
                  placeholder="Memorable password to unlock editor"
                  onChange={(ev) => setTempPassword(ev.target.value)}
                />
              </div>
            )}

            <div className="half-width">
              <div>
                <div>
                  <input
                    type="checkbox"
                    id="remember-secret"
                    defaultChecked={rememberLogin}
                    onChange={(ev) => setRememberLogin(ev.target.checked)}
                  ></input>
                  <label htmlFor="remember-secret">Remember login</label>
                </div>
              </div>
              <button type="submit">Login</button>
            </div>
          </form>
        )}
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
