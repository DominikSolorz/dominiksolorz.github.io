package pl.solorz.homesecurity;
import org.junit.Test;
import static org.junit.Assert.*;
public class UpdatePolicyTest {
    private final String url="https://github.com/DominikSolorz/dominiksolorz.github.io/releases/download/android-0.3.0/HomeSecurity.apk";
    private final String hash=new String(new char[64]).replace('\0','a');
    @Test public void newerSamePackageIsAllowed(){assertTrue(UpdatePolicy.valid("app","app",4,3,url,hash,100));}
    @Test public void downgradeAndSameVersionAreRejected(){assertFalse(UpdatePolicy.valid("app","app",3,3,url,hash,100));assertFalse(UpdatePolicy.valid("app","app",2,3,url,hash,100));}
    @Test public void otherPackageAndInvalidIntegrityAreRejected(){assertFalse(UpdatePolicy.valid("other","app",4,3,url,hash,100));assertFalse(UpdatePolicy.valid("app","app",4,3,url,"abc",100));assertFalse(UpdatePolicy.valid("app","app",4,3,url,hash,0));assertFalse(UpdatePolicy.valid("app","app",4,3,url,hash,67108865));}
    @Test public void foreignHostsAndInsecureUrlsAreRejected(){
        for(String u:new String[]{url.replace("https:","http:"),url.replace("github.com","github.com.attacker.example"),url.replace("github.com","github.com@attacker.example"),url.replace("DominikSolorz","AnotherOwner"),url.replace("/android-0.3.0/","/../"),url.replace("/android-0.3.0/","/%2e%2e/"),url+"?token=secret",url+"#fragment",url.replace("github.com","github.com:443")})assertFalse(u,UpdatePolicy.trustedDownload(u));
    }
    @Test public void redirectOriginsRemainRestricted(){assertTrue(UpdatePolicy.trustedTransport("https://release-assets.githubusercontent.com/a?sig=test"));assertFalse(UpdatePolicy.trustedTransport("http://release-assets.githubusercontent.com/a"));assertFalse(UpdatePolicy.trustedTransport("https://attacker.example/a"));}
    @Test public void digestFormattingPreservesLeadingZeros(){assertEquals("000fff",UpdatePolicy.hex(new byte[]{0,15,(byte)255}));}
}
